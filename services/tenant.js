import mongoose from "mongoose";
import crypto from "crypto";
import { addATenantRepo } from "../repositories/tenant.js";
import { addATenantUserRepo } from "../repositories/tenantUser.js";
import { addAUserRepo } from "../repositories/user.js";
import { generateHash } from "../utils/misc.js";
import config from "../config/index.js";
import logger from "../utils/logger.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { initializeStoreSetup } from "./storeSetup.js";
import { enqueueStoreSetup } from "./jobs/index.js";
import { upsertPlatformSubdomainDomain } from "./domainRegistry.js";
import { APIError } from "../middlewares/errorHandler.js";

const addATenantService = async (tenantData) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // `passwordHash` lets an EXISTING user spin up an additional store with
    // their current credentials (we copy their bcrypt hash; the User
    // pre-save hook skips re-hashing values already starting with "$2b$").
    // Otherwise hash the plaintext password from a fresh signup.
    const hashedPassword = tenantData.passwordHash || (await generateHash(tenantData.password));

    // The STORE name comes from `storeName`; the user's full `name` is the
    // admin account's name. Fall back to `name` only for legacy callers that
    // didn't send storeName.
    const storeName = tenantData.storeName || tenantData.name;
    const slug = tenantData.subdomain || storeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const Tenant = mongoose.model("Tenant");
    const isSubdomainAvailable = await Tenant.isSubdomainAvailable(slug);
    if (!isSubdomainAvailable) {
      // 409 + APIError so the global error handler doesn't wrap it as a
      // masked 500. The dashboard relies on the body message to render
      // an inline form error on the subdomain field.
      throw new APIError(`Subdomain "${slug}" is already taken`, 409);
    }

    const fullSubdomain = `${slug}.${config.domainSuffix}`;

    // One-time setup token — gates the unauthenticated /store-setup/status
    // poll endpoint so a third party who happens to know the tenantId
    // (or guesses an ObjectId) can't poll/clear another tenant's setup
    // state. Returned to the client in the register response and never
    // re-issued.
    const setupToken = crypto.randomUUID();

    const tenantPayload = {
      name: storeName,
      slug,
      domain: fullSubdomain,
      email: tenantData.email,
      subscriptionPlan: tenantData.subscriptionPlan || "trial",
      setupStatus: {
        status: "pending",
        setupToken,
      },
      domains: {
        subdomain: {
          name: slug,
          fullDomain: fullSubdomain,
          isActive: true,
        },
        customDomain: { isVerified: false },
        primaryDomain: "subdomain",
      },
      settings: {
        storeName,
        // Stable per-store secret for the owner draft-preview link
        // (?preview=<token> reveals unpublished/draft content on the storefront).
        previewToken: crypto.randomBytes(16).toString("hex"),
        currency: tenantData.currency || "SDG",
        timezone: tenantData.timezone || "Africa/Khartoum",
        language: tenantData.language || "en",
        activeTheme: tenantData.themeSlug || "modern",
      },
    };

    // If a theme was selected, set up themeCustomization
    if (tenantData.themeSlug) {
      const Theme = mongoose.model("Theme");
      const selectedTheme = await Theme.findOne({ slug: tenantData.themeSlug, status: "active" });
      if (selectedTheme) {
        tenantPayload.themeCustomization = {
          themeId: selectedTheme._id,
          isDraft: false,
          settings: selectedTheme.settings || {},
          sections: selectedTheme.sections || [],
          lastPublishedAt: new Date(),
          updatedAt: new Date(),
        };
        // Increment install count
        await Theme.findByIdAndUpdate(selectedTheme._id, {
          $inc: { "statistics.installCount": 1, "statistics.activeInstalls": 1 },
        });
      }
    }

    const data = await addATenantRepo(tenantPayload, session);
    let userData;
    let adminUser;

    if (data._id) {
      // Register the platform-subdomain row in the Domain registry
      // inside the same transaction so either both exist or neither
      // does. The registry is the single source of truth for
      // hostname → tenant resolution (see services/domainRegistry.js).
      await upsertPlatformSubdomainDomain(data._id, slug, { session });

      userData = await addATenantUserRepo(
        {
          id: data._id,
          email: tenantData.email,
          name: tenantData.name,
          tenantId: data._id,
        },
        session
      );

      // Create scoped models for the new tenant and create admin user
      const models = createScopedModels(mongoose.connection, data._id);
      adminUser = await addAUserRepo(models, {
        name: tenantData.name,
        email: tenantData.email,
        password: hashedPassword,
        roles: ["admin"],
      });

      await session.commitTransaction();
      await session.endSession();

      // Trigger store setup asynchronously via the BullMQ queue so a
      // worker process owns the long-running work. The previous
      // fire-and-forget `.catch()` on the request thread meant a web
      // dyno restart mid-setup left the tenant half-built with no
      // retry path.
      //
      // Skipped under NODE_ENV=test because the background work races
      // with subsequent test cases (auto-setup grabs locks on the
      // tenants collection well after register returns). Tests that
      // need post-setup state should drive the setup explicitly.
      //
      // In dev we always run inline rather than enqueuing. Enqueuing
      // succeeds whenever Redis is up, but jobs only progress when a
      // separate `npm run worker` process is also running — that's a
      // confusing dev experience where registration silently hangs at
      // "registering domain" because the API process never sees the
      // job get picked up. Inline execution in dev keeps registration
      // self-contained; production always uses the queue so the web
      // dyno can be recycled without losing in-flight setups.
      if (!config.isTest) {
        logger.info(`Triggering store setup for: ${data.name}`, { tenantId: data._id.toString() });
        if (config.isProduction) {
          enqueueStoreSetup(data._id, { source: "register" })
            .then((job) => {
              logger.info("Store setup enqueued", {
                tenantId: data._id.toString(),
                jobId: job.id,
              });
            })
            .catch((error) => {
              logger.warn(
                `Failed to enqueue store setup (${error.message}); running inline as fallback`,
                { tenantId: data._id.toString() }
              );
              initializeStoreSetup(data, models).catch((err) => {
                logger.error(`Store setup failed for ${data.name}: ${err.message}`, {
                  tenantId: data._id.toString(),
                });
              });
            });
        } else {
          // Dev: run inline so the registration flow doesn't depend on a
          // separately-launched worker process.
          initializeStoreSetup(data, models).catch((err) => {
            logger.error(`Store setup failed for ${data.name}: ${err.message}`, {
              tenantId: data._id.toString(),
            });
          });
        }
      }
    }

    return {
      success: true,
      statusCode: 201,
      message: "Tenant added successfully. Store setup is in progress.",
      responseObject: {
        tenantId: data._id,
        userId: userData?._id,
        // The tenant-scoped admin User id (what JWTs are signed with) — used
        // by the add-store flow to hand the user straight into the new store.
        adminUserId: adminUser?._id,
        slug: data.slug,
        subdomain: data.domains.subdomain.fullDomain,
        domain: data.domain,
        activeDomain: data.getActiveDomain(),
        setupInProgress: true,
        // The dashboard polls /store-setup/status with this token before
        // the user has a JWT (auto-login happens *after* setup completes).
        // Treat it like an opaque secret — never log it or expose elsewhere.
        setupToken,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

/**
 * Create an ADDITIONAL store for an already-registered user. Reuses the full
 * tenant-creation pipeline but, instead of a fresh password, copies the
 * existing user's bcrypt hash so they sign into the new store with the same
 * credentials and it shows up in their store picker. `existingUser` is the
 * authenticated user's tenant-scoped User doc ({ name, email, password }).
 */
const addStoreForExistingUserService = (existingUser, storeData = {}) =>
  addATenantService({
    name: existingUser.name,
    email: existingUser.email,
    passwordHash: existingUser.password,
    storeName: storeData.storeName,
    subdomain: storeData.subdomain,
    themeSlug: storeData.themeSlug,
    niche: storeData.niche,
    currency: storeData.currency,
    language: storeData.language,
    subscriptionPlan: storeData.subscriptionPlan,
  });

export { addATenantService, addStoreForExistingUserService };

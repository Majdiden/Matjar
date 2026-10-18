/**
 * Platform announcements (PBI 10-46, 10-54): the Matjar team sends a
 * notification to every store or to the stores it picks.
 *
 * Channels, chosen by the sender and filtered by each staff member's own
 * switches for the `platform.announcement` type (Settings → Notifications):
 *   - app:   one notification per store through the same pipeline as a new
 *            order (services/notification.js#emit): the notifications page,
 *            the live popup in an open dashboard, and a phone / desktop
 *            notification (Web Push) on every device where it is switched on;
 *   - email: a formatted message (services/emailTemplates/platformAnnouncement.js)
 *            to every staff member with an email address who has not switched
 *            announcement emails off.
 *
 * `measureAudience` shows the sender, before sending, how many stores, people,
 * phones / computers and inboxes each channel reaches. Sending records the
 * announcement, answers at once and delivers in the background; the history
 * shows progress, the final counts and who opened it: unique people who read
 * the app notification (the notifications page, or a tapped phone
 * notification), opened the email (tracking image) or clicked its button.
 */
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { emit, STAFF_ROLES } from "../notification.js";
import { ANNOUNCEMENT_TYPE, pickLanguage } from "../notificationCopy.js";
import { pushEnabledFor } from "../pushNotifications.js";
import { sendEmail, isEmailConfigured } from "../providers/email.js";
import { platformFrom } from "../emailIdentity.js";
import { buildAnnouncementEmail } from "../emailTemplates/platformAnnouncement.js";
import { notificationPreferencesUrl } from "../../utils/notificationLinks.js";
import { isWebPushConfigured } from "../../utils/webPush.js";
import { trackingUrls } from "../../utils/announcementTracking.js";
import { ANNOUNCEMENT_NAMES_KEPT } from "../../schemas/announcement.js";
import config from "../../config/index.js";

/** The Matjar icon in emails (served with the dashboard). */
const matjarLogoUrl = () => `${config.publicDashboardUrl}/dashboard/pwa-192x192.png`;


/** Stores delivered to at the same time. */
const SEND_CONCURRENCY = 4;
const HISTORY_LIMIT = 50;

const Announcement = () => mongoose.model("Announcement");
const AnnouncementEvent = () => mongoose.model("AnnouncementEvent");
const Tenant = () => mongoose.model("Tenant");

const LIVE_STORE = { deletedAt: null, isActive: true };

/** A staff member wants announcement emails unless they switched them off. */
export const emailWantedBy = (user) =>
  user?.notificationPreferences?.[ANNOUNCEMENT_TYPE]?.email !== false;

/** Staff members of these stores who can be reached at all. */
async function staffOf(tenantIds) {
  if (!tenantIds.length) return [];
  return mongoose
    .model("User")
    .find({ tenantId: { $in: tenantIds }, isActive: true, roles: { $in: Array.from(STAFF_ROLES) } })
    .select("_id tenantId email language notificationPreferences")
    .lean();
}

/** The store ids a target names (null for every store). */
const pickedIds = ({ target, tenantId, tenantIds }) =>
  target === "tenant" ? [tenantId] : target === "tenants" ? tenantIds || [] : null;

/** The stores an announcement goes to. */
async function targetStores(t) {
  const ids = pickedIds(t);
  const filter = ids ? { ...LIVE_STORE, _id: { $in: ids } } : LIVE_STORE;
  return Tenant()
    .find(filter)
    .select("_id name email settings.storeName settings.language")
    .lean();
}

/**
 * Who each channel reaches right now:
 * { stores, recipients, app, devices, email, pushReady, emailReady }.
 * `devices` counts phones / computers with notifications on for staff who
 * did not switch announcement popups off.
 */
export async function measureAudience(t) {
  const stores = await targetStores(t);
  const ids = stores.map((s) => s._id);
  const staff = await staffOf(ids);

  const pushUserIds = staff.filter((u) => pushEnabledFor(u, ANNOUNCEMENT_TYPE)).map((u) => u._id);
  const devices = pushUserIds.length
    ? await mongoose
        .model("PushSubscription")
        .countDocuments({ tenantId: { $in: ids }, user: { $in: pushUserIds } })
    : 0;

  return {
    stores: stores.length,
    recipients: staff.length,
    app: staff.length,
    devices,
    email: staff.filter((u) => u.email && emailWantedBy(u)).length,
    pushReady: isWebPushConfigured(),
    emailReady: isEmailConfigured(),
  };
}

/** The stored text in one language, else the other. */
const textIn = (pair, lang) => (pair?.[lang] || pair?.[lang === "ar" ? "en" : "ar"] || "").trim();

/** Deliver to one store; returns { app, email, failed }. */
async function deliverToStore(doc, store) {
  const out = { app: 0, email: 0, failed: 0 };
  const plain = (v) => (v && typeof v.toObject === "function" ? v.toObject() : v);
  const title = plain(doc.title);
  const body = plain(doc.body);

  if (doc.channels.app) {
    const models = createScopedModels(mongoose.connection, store._id);
    const created = await emit(models, store._id, {
      type: ANNOUNCEMENT_TYPE,
      severity: "info",
      title: textIn(title, "en"),
      body: textIn(body, "en"),
      resourceType: "announcement",
      resourceId: doc._id,
      permission: null,
      data: { announcementId: String(doc._id), title, body, link: doc.link || null },
    });
    if (created) out.app = 1;
    else out.failed++;
  }

  if (doc.channels.email && isEmailConfigured()) {
    const staff = (await staffOf([store._id])).filter((u) => u.email && emailWantedBy(u));
    const storeName = store.settings?.storeName || store.name;
    for (const user of staff) {
      // Per person: the button goes through the click counter and a tracking
      // image counts the open (utils/announcementTracking.js).
      const { pixelUrl, clickUrl } = trackingUrls({ announcementId: doc._id, tenantId: store._id, userId: user._id });
      // The store's language first: a staff account's own `language` is a
      // schema default ("en"), not a choice the merchant made.
      const language = pickLanguage(store.settings?.language, user.language);
      const mail = buildAnnouncementEmail({
        title: textIn(title, language),
        body: textIn(body, language),
        linkUrl: clickUrl,
        pixelUrl,
        prefsUrl: notificationPreferencesUrl(),
        storeName,
        matjarLogoUrl: matjarLogoUrl(),
        language,
      });
      try {
        const res = await sendEmail({ to: user.email, ...mail, from: platformFrom() });
        if (res?.success === false) out.failed++;
        else out.email++;
      } catch (err) {
        out.failed++;
        logger.warn("announcement email failed", { tenantId: String(store._id), error: err?.message });
      }
    }
  }
  return out;
}

/** Deliver a saved announcement to its stores, recording the counts. */
export async function deliverAnnouncement(doc) {
  const delivered = { stores: 0, app: 0, email: 0, failed: 0 };
  try {
    const stores = await targetStores(doc);
    let next = 0;
    const worker = async () => {
      while (next < stores.length) {
        const store = stores[next++];
        try {
          const r = await deliverToStore(doc, store);
          delivered.stores++;
          delivered.app += r.app;
          delivered.email += r.email;
          delivered.failed += r.failed;
        } catch (err) {
          delivered.failed++;
          logger.warn("announcement delivery failed", { tenantId: String(store._id), error: err?.message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, stores.length || 1) }, worker));
    await Announcement().updateOne(
      { _id: doc._id },
      { $set: { status: "sent", delivered, finishedAt: new Date() } }
    );
  } catch (err) {
    logger.error("announcement delivery aborted", { id: String(doc._id), error: err?.message });
    await Announcement()
      .updateOne(
        { _id: doc._id },
        { $set: { status: "failed", delivered, error: String(err?.message || err).slice(0, 500), finishedAt: new Date() } }
      )
      .catch(() => {});
  }
  return delivered;
}

/**
 * Save an announcement and start delivering it. Resolves once saved, with the
 * delivery promise for callers that wait (tests); the HTTP handler does not.
 */
export async function sendAnnouncement(input, actor) {
  let tenantName = null;
  let tenantIds;
  let tenantNames;
  const ids = pickedIds(input);
  if (ids) {
    const unique = [...new Set(ids.map(String))];
    const stores = await Tenant().find({ ...LIVE_STORE, _id: { $in: unique } }).select("name settings.storeName").lean();
    if (stores.length !== unique.length) {
      const err = new Error(
        unique.length === 1 ? "Store not found or not active" : `${unique.length - stores.length} of the picked stores are not active`
      );
      err.statusCode = 404;
      throw err;
    }
    const nameOf = (st) => st.settings?.storeName || st.name;
    if (input.target === "tenant") tenantName = nameOf(stores[0]);
    else {
      tenantIds = unique;
      tenantNames = stores.slice(0, ANNOUNCEMENT_NAMES_KEPT).map(nameOf);
    }
  }
  const audience = await measureAudience(input);
  const doc = await Announcement().create({
    title: input.title,
    body: input.body,
    link: input.link || null,
    channels: input.channels,
    target: input.target,
    tenantId: input.target === "tenant" ? input.tenantId : null,
    tenantName,
    tenantIds,
    tenantNames,
    audience: {
      stores: audience.stores,
      recipients: audience.recipients,
      app: input.channels.app ? audience.app : 0,
      devices: input.channels.app ? audience.devices : 0,
      email: input.channels.email ? audience.email : 0,
    },
    createdBy: actor.id,
    createdByEmail: actor.email || null,
  });
  const delivery = deliverAnnouncement(doc);
  return { doc, delivery };
}

/**
 * App reads per announcement: unique people who read its notification (the
 * notifications page, or by tapping the phone notification) and the stores
 * they belong to. Read from the stores' notifications, which keep `readBy`.
 */
async function appReads(ids) {
  if (!ids.length) return new Map();
  const rows = await mongoose.connection.db
    .collection("notifications")
    .aggregate([
      { $match: { type: ANNOUNCEMENT_TYPE, resourceType: "announcement", resourceId: { $in: ids } } },
      {
        $group: {
          _id: "$resourceId",
          people: { $sum: { $size: { $ifNull: ["$readBy", []] } } },
          stores: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$readBy", []] } }, 0] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), { people: r.people, stores: r.stores }]));
}

export async function listAnnouncements({ limit = HISTORY_LIMIT } = {}) {
  const items = await Announcement().find({}).sort({ createdAt: -1 }).limit(Math.min(limit, HISTORY_LIMIT)).lean();
  const reads = await appReads(items.map((a) => a._id));
  return items.map((a) => ({ ...a, appRead: reads.get(String(a._id)) || { people: 0, stores: 0 } }));
}

const EVENT_COUNTER = { email_open: "engagement.emailOpened", email_click: "engagement.emailClicked" };

/**
 * Record one person opening or clicking an announcement email. Counts each
 * person once per kind; a click also counts as an open (the image may have
 * been blocked). Returns the announcement's link for the click redirect.
 */
export async function recordEmailEvent({ announcementId, tenantId, userId }, kind) {
  const doc = await Announcement().findById(announcementId).select("link").lean();
  if (!doc) return null;
  const kinds = kind === "email_click" ? ["email_click", "email_open"] : ["email_open"];
  for (const k of kinds) {
    try {
      await AnnouncementEvent().create({ announcementId, tenantId, userId, kind: k });
      await Announcement().updateOne({ _id: announcementId }, { $inc: { [EVENT_COUNTER[k]]: 1 } });
    } catch (err) {
      if (err?.code !== 11000) logger.warn("announcement event not recorded", { kind: k, error: err?.message });
    }
  }
  return doc;
}

export function publicAnnouncement(a) {
  if (!a) return null;
  return {
    id: String(a._id),
    title: a.title,
    body: a.body,
    link: a.link,
    channels: a.channels,
    target: a.target,
    tenantId: a.tenantId ? String(a.tenantId) : null,
    tenantName: a.tenantName,
    storeCount: a.tenantIds?.length ?? (a.target === "tenant" ? 1 : null),
    tenantNames: a.tenantNames || (a.tenantName ? [a.tenantName] : []),
    status: a.status,
    audience: a.audience,
    delivered: a.delivered,
    engagement: {
      emailOpened: a.engagement?.emailOpened || 0,
      emailClicked: a.engagement?.emailClicked || 0,
      appReadPeople: a.appRead?.people || 0,
      appReadStores: a.appRead?.stores || 0,
    },
    error: a.error,
    createdByEmail: a.createdByEmail,
    createdAt: a.createdAt,
    finishedAt: a.finishedAt,
  };
}

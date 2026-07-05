import mongoose from "mongoose";
import config from "../config/index.js";

const Tenant = () => mongoose.model("Tenant");

// Platform domain suffix — sourced from config so local/staging/
// white-label deployments don't bake in `matjar.to`.
const platformSuffix = () => config.domainSuffix || config.baseDomain;

export const setCustomDomainRepo = async (tenantId, customDomainData) => {
  return await Tenant().findByIdAndUpdate(
    tenantId,
    { $set: { "domains.customDomain": customDomainData } },
    { new: true }
  );
};

export const verifyCustomDomainRepo = async (tenantId) => {
  return await Tenant().findByIdAndUpdate(
    tenantId,
    {
      $set: {
        "domains.customDomain.isVerified": true,
        "domains.customDomain.verifiedAt": new Date(),
      },
    },
    { new: true }
  );
};

export const removeCustomDomainRepo = async (tenantId) => {
  return await Tenant().findByIdAndUpdate(
    tenantId,
    {
      $set: {
        "domains.customDomain": {
          name: null,
          isVerified: false,
          verificationCode: null,
          verificationMethod: null,
          verifiedAt: null,
          sslEnabled: false,
          sslIssuedAt: null,
        },
        "domains.primaryDomain": "subdomain",
      },
    },
    { new: true }
  );
};

export const setPrimaryDomainRepo = async (tenantId, primaryDomain) => {
  return await Tenant().findByIdAndUpdate(
    tenantId,
    { $set: { "domains.primaryDomain": primaryDomain } },
    { new: true }
  );
};

export const updateSubdomainRepo = async (tenantId, subdomainName) => {
  const slug = subdomainName.toLowerCase();
  return await Tenant().findByIdAndUpdate(
    tenantId,
    {
      $set: {
        "domains.subdomain.name": slug,
        "domains.subdomain.fullDomain": `${slug}.${platformSuffix()}`,
      },
    },
    { new: true }
  );
};

export const enableSSLRepo = async (tenantId) => {
  return await Tenant().findByIdAndUpdate(
    tenantId,
    {
      $set: {
        "domains.customDomain.sslEnabled": true,
        "domains.customDomain.sslIssuedAt": new Date(),
      },
    },
    { new: true }
  );
};

export const checkSubdomainAvailabilityRepo = async (subdomain) => {
  return await Tenant().isSubdomainAvailable(subdomain);
};

export const checkCustomDomainAvailabilityRepo = async (domain) => {
  return await Tenant().isCustomDomainAvailable(domain);
};

export const findTenantByDomainRepo = async (domain) => {
  return await Tenant().findByDomain(domain);
};

export const getTenantsWithCustomDomainsRepo = async () => {
  return await Tenant().find({
    "domains.customDomain.name": { $exists: true, $ne: null },
    isActive: true,
  }).select("name slug domains subscriptionPlan");
};

export const getPendingVerificationsRepo = async () => {
  return await Tenant().find({
    "domains.customDomain.name": { $exists: true, $ne: null },
    "domains.customDomain.isVerified": false,
    isActive: true,
  }).select("name slug domains email");
};

export const getTenantsByPlanRepo = async (plan) => {
  return await Tenant().find({
    subscriptionPlan: plan,
    isActive: true,
  }).select("name slug domains subscriptionPlan");
};

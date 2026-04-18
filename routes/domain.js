/**
 * Domain Routes
 * Routes for domain management (subdomains and custom domains)
 */

import express from "express";
import {
  checkSubdomainAvailability,
  updateSubdomain,
  checkCustomDomainAvailability,
  addCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
  setPrimaryDomain,
  enableSSL,
  getDomainInfo,
  checkDNSPropagation,
  getTenantsWithCustomDomains,
  getPendingVerifications,
  getVerificationInstructions,
} from "../controllers/domain.js";
import { authenticate, optionalAuth } from "../middlewares/auth.js";
import { isAdmin, requirePermission } from "../middlewares/authorize.js";
import { domainCheckLimiter } from "../middlewares/rateLimiters.js";

const router = express.Router();
router.use(optionalAuth);

// ============================================
// PUBLIC ROUTES (Domain Availability Checks)
// ============================================

/**
 * @route   GET /api/domains/check-subdomain
 * @desc    Check if subdomain is available
 * @access  Public
 * @example GET /api/domains/check-subdomain?subdomain=mystore
 */
router.get("/check-subdomain", domainCheckLimiter, checkSubdomainAvailability);

/**
 * @route   GET /api/domains/check-custom-domain
 * @desc    Check if custom domain is available
 * @access  Public
 * @example GET /api/domains/check-custom-domain?domain=mystore.com
 */
router.get("/check-custom-domain", domainCheckLimiter, checkCustomDomainAvailability);

// ============================================
// PROTECTED ROUTES (Tenant Admin)
// ============================================

// Apply authentication middleware to all routes below
router.use(authenticate);

/**
 * @route   GET /api/domains/info
 * @desc    Get domain information for current tenant
 * @access  Private (Tenant Admin)
 * @returns {Object} subdomain, customDomain, primaryDomain, activeDomain, allDomains, subscriptionPlan
 */
router.get("/info", requirePermission("domains.read"), getDomainInfo);

/**
 * @route   GET /api/domains/verification-instructions
 * @desc    Get current verification instructions for custom domain
 * @access  Private (Tenant Admin)
 */
router.get("/verification-instructions", requirePermission("domains.read"), getVerificationInstructions);

// ============================================
// SUBDOMAIN MANAGEMENT
// ============================================

/**
 * @route   PATCH /api/domains/subdomain
 * @desc    Update tenant subdomain
 * @access  Private (Tenant Admin)
 * @body    { subdomain: string }
 * @example PATCH /api/domains/subdomain
 *          Body: { "subdomain": "mynewstore" }
 */
router.patch("/subdomain", requirePermission("domains.write"), updateSubdomain);

// ============================================
// CUSTOM DOMAIN MANAGEMENT
// ============================================

/**
 * @route   POST /api/domains/custom
 * @desc    Add custom domain to tenant
 * @access  Private (Tenant Admin)
 * @body    { domain: string, verificationMethod?: "dns" | "cname" | "txt" }
 * @example POST /api/domains/custom
 *          Body: { "domain": "mystore.com", "verificationMethod": "dns" }
 */
router.post("/custom", requirePermission("domains.write"), addCustomDomain);

/**
 * @route   POST /api/domains/custom/verify
 * @desc    Verify custom domain ownership via DNS
 * @access  Private (Tenant Admin)
 * @example POST /api/domains/custom/verify
 */
router.post("/custom/verify", requirePermission("domains.write"), verifyCustomDomain);

/**
 * @route   DELETE /api/domains/custom/:domainId?
 * @desc    Remove custom domain. When multiple custom-domain registry
 *          rows exist, the dashboard must pass the clicked row id so
 *          the backend does not delete the latest embedded customDomain
 *          by mistake.
 * @access  Private (Tenant Admin)
 * @example DELETE /api/domains/custom
 */
router.delete("/custom/:domainId", requirePermission("domains.write"), removeCustomDomain);
router.delete("/custom", requirePermission("domains.write"), removeCustomDomain);

/**
 * @route   POST /api/domains/custom/ssl
 * @desc    Enable SSL for custom domain
 * @access  Private (Tenant Admin)
 * @example POST /api/domains/custom/ssl
 */
router.post("/custom/ssl", requirePermission("domains.write"), enableSSL);

// ============================================
// PRIMARY DOMAIN MANAGEMENT
// ============================================

/**
 * @route   PATCH /api/domains/primary
 * @desc    Set primary domain (subdomain or custom)
 * @access  Private (Tenant Admin)
 * @body    { primaryDomain: "subdomain" | "custom" }
 * @example PATCH /api/domains/primary
 *          Body: { "primaryDomain": "custom" }
 */
router.patch("/primary", requirePermission("domains.write"), setPrimaryDomain);

// ============================================
// DNS UTILITIES
// ============================================

/**
 * @route   GET /api/domains/dns-check
 * @desc    Check DNS propagation status
 * @access  Private (Tenant Admin)
 * @query   { domain: string }
 * @example GET /api/domains/dns-check?domain=mystore.com
 */
router.get("/dns-check", domainCheckLimiter, requirePermission("domains.read"), checkDNSPropagation);

// ============================================
// ADMIN ROUTES (platform admin only)
// ============================================

/**
 * @route   GET /api/domains/admin/custom-domains
 * @desc    Get all tenants with custom domains (Admin only)
 * @access  Private (Admin)
 */
router.get("/admin/custom-domains", isAdmin, getTenantsWithCustomDomains);

/**
 * @route   GET /api/domains/admin/pending-verifications
 * @desc    Get all pending domain verifications (Admin only)
 * @access  Private (Admin)
 */
router.get("/admin/pending-verifications", isAdmin, getPendingVerifications);

export default router;

import { Router } from "express";
// Billing: commission policies, overrides, fee ledger, statements, plan
// changes. Mounted at /api/platform/billing behind platformAuthenticate.
// Reads need billing.read, writes need billing.write. The ledger and
// statements expose NO update/delete routes (append-only).
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createPolicySchema,
  updatePolicySchema,
  billingSettingsSchema,
  createOverrideSchema,
  revokeOverrideSchema,
  adjustmentSchema,
  generateStatementSchema,
  paymentSchema,
  reasonOnlySchema,
  runPeriodSchema,
  operatorPlanChangeSchema,
  listStatementsQuerySchema,
  ledgerQuerySchema,
  previewPolicySchema,
  fxTableSchema,
} from "../../validators/billing.validator.js";
import * as c from "../../controllers/platform/billing.js";
import { registerBillingListeners } from "../../services/platform/billing/index.js";

// Order → commission listeners live in the API process (where order events
// are emitted). Registering here guarantees they are wired whenever the
// platform router is mounted; the call is idempotent.
registerBillingListeners();

const router = Router({ mergeParams: true });
const read = requireScope(PLATFORM_SCOPES.BILLING_READ);
const write = requireScope(PLATFORM_SCOPES.BILLING_WRITE);

// Settings
router.get("/settings", read, c.getSettings);
router.put("/settings", write, validate(billingSettingsSchema), c.updateSettings);

// Platform-owned FX reference table (drives tier lookups + base-fee conversion)
router.get("/fx", read, c.getFx);
router.put("/fx", write, validate(fxTableSchema), c.updateFx);

// Commission policies
router.get("/policies", read, c.listPolicies);
router.post("/policies", write, validate(createPolicySchema), c.createPolicy);
router.post("/policies/preview", read, validate(previewPolicySchema), c.previewPolicy);
router.patch("/policies/:id", write, validateObjectId("id"), validate(updatePolicySchema), c.updatePolicy);
router.delete("/policies/:id", write, validateObjectId("id"), c.deletePolicy);

// Statements (cross-tenant)
router.get("/statements", read, validate(listStatementsQuerySchema), c.listAllStatements);
router.get("/statements/:id", read, validateObjectId("id"), c.getOneStatement);
router.post("/statements/:id/issue", write, validateObjectId("id"), c.issueOneStatement);
router.post("/statements/:id/payments", write, validateObjectId("id"), validate(paymentSchema), c.payStatement);
router.post("/statements/:id/waive", write, validateObjectId("id"), validate(reasonOnlySchema), c.waiveOneStatement);
router.post("/statements/:id/void", write, validateObjectId("id"), validate(reasonOnlySchema), c.voidOneStatement);

// Period close (what the monthly cron does)
router.post("/run-period", write, validate(runPeriodSchema), c.runPeriod);

// Per-tenant
router.get("/tenants/:tenantId/effective", read, validateObjectId("tenantId"), c.getEffective);
router.post("/tenants/:tenantId/overrides", write, validateObjectId("tenantId"), validate(createOverrideSchema), c.createOverride);
router.post("/tenants/:tenantId/overrides/:id/revoke", write, validateObjectId("tenantId", "id"), validate(revokeOverrideSchema), c.revokeOverride);
router.get("/tenants/:tenantId/ledger", read, validateObjectId("tenantId"), validate(ledgerQuerySchema), c.getLedger);
router.post("/tenants/:tenantId/adjustments", write, validateObjectId("tenantId"), validate(adjustmentSchema), c.createAdjustment);
router.get("/tenants/:tenantId/statements", read, validateObjectId("tenantId"), c.listTenantStatements);
router.post("/tenants/:tenantId/statements/generate", write, validateObjectId("tenantId"), validate(generateStatementSchema), c.generateTenantStatement);
router.post("/tenants/:tenantId/plan-change", write, validateObjectId("tenantId"), validate(operatorPlanChangeSchema), c.operatorPlanChange);
router.post("/tenants/:tenantId/plan-change/cancel", write, validateObjectId("tenantId"), c.cancelPlanChange);

export default router;

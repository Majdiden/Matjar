import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import {
  createPaymentIntentController,
  webhookController,
  refundController,
  listOrderPaymentsController,
  listPaymentsController,
  getPaymentController,
  verifyManualPaymentController,
} from "../controllers/payment.js";
import { checkoutLimiter, webhookLimiter } from "../middlewares/rateLimiters.js";
import { idempotency } from "../middlewares/idempotency.js";
import config from "../config/index.js";

const router = express.Router();

// Gateway payment surfaces (Stripe create-intent + webhook) are parked
// behind STRIPE_ENABLED. The provider code stays dormant; only the
// externally-reachable routes are gated. `PAYMENTS_ENABLED` governs the
// manual rails (COD, bank transfer, Fawry, …) and is independent of
// gateway availability — a soft-launch deploy runs with
// PAYMENTS_ENABLED=true and STRIPE_ENABLED=false. Flip STRIPE_ENABLED=true
// (and supply STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) to re-expose the
// gateway routes.
const stripeEnabled = config.stripeEnabled;
const gatewayDisabled = (_req, res) =>
  res.status(404).json({ success: false, message: "Gateway payments are disabled on this instance" });

if (stripeEnabled) {
  // Stripe webhook must receive raw body — mount BEFORE json parser.
  router.post("/webhook", webhookLimiter, express.raw({ type: "application/json" }), webhookController);
  router.post("/create-intent", checkoutLimiter, authenticate, createPaymentIntentController);
} else {
  router.post("/webhook", gatewayDisabled);
  router.post("/create-intent", gatewayDisabled);
}

router.get("/", authenticate, requirePermission("payments.read"), requireFeature("payments.transactions"), listPaymentsController);
router.get("/order/:orderId", authenticate, requirePermission("payments.read"), requireFeature("payments.transactions"), listOrderPaymentsController);
router.get("/:id", authenticate, requirePermission("payments.read"), requireFeature("payments.transactions"), getPaymentController);
router.post("/refund", authenticate, requirePermission("payments.refund"), requireFeature("payments.transactions"), idempotency(), refundController);
router.post("/verify-manual", authenticate, requirePermission("payments.verify"), requireFeature("payments.transactions"), verifyManualPaymentController);

export default router;

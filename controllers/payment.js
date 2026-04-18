import crypto from "crypto";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  createPaymentIntent,
  handlePaymentWebhook,
  createRefund,
  isStripeConfigured,
} from "../services/payment.js";
import { guardTransition } from "../utils/orderStateMachine.js";
import { logStateChange } from "../utils/auditLog.js";
import logger from "../utils/logger.js";
import { emit as emitNotification } from "../services/notification.js";

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a Stripe payment intent for an order
 * @access  Private
 */
export const createPaymentIntentController = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Payment processing is not configured",
    });
  }

  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: "Order ID is required" });
  }

  const order = await req.models.Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Verify the order belongs to the requesting user
  if (order.user.toString() !== req.user.userId) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const result = await createPaymentIntent(order, req.tenantId);

  // Store payment intent ID on the order
  await req.models.Order.findByIdAndUpdate(orderId, {
    paymentIntentId: result.paymentIntentId,
  });

  res.json({
    success: true,
    data: { clientSecret: result.clientSecret },
  });
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (verified by Stripe signature)
 */
export const webhookController = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await handlePaymentWebhook(req.body, signature);

    if (result.type === "payment_success") {
      // Import mongoose to get connection for scoped models
      const mongoose = (await import("mongoose")).default;
      const { createScopedModels } = await import("../utils/scopedModel.js");
      const models = createScopedModels(mongoose.connection, result.tenantId);

      // Check idempotency — skip if this event was already processed
      const existingPayment = await models.Payment.findOne({ eventId: result.eventId });
      if (existingPayment) {
        return res.json({ received: true });
      }

      // Read the order to get current status for state machine guard.
      const order = await models.Order.findOne({ _id: result.orderId });
      if (order) {
        const prevPayment = order.paymentStatus || "Not Paid";
        const prevOrder = order.status || "Pending";

        // Guard both transitions — if illegal, log and skip rather than crash
        // (webhooks must always return 200 to avoid Stripe retries).
        try {
          guardTransition("payment", prevPayment, "Paid");
          guardTransition("order", prevOrder, "Processing");
        } catch (err) {
          logger.warn("Webhook transition rejected", {
            orderId: result.orderId,
            paymentFrom: prevPayment,
            orderFrom: prevOrder,
            reason: err.message,
          });
          return res.json({ received: true });
        }

        const now = new Date();
        await models.Order.findByIdAndUpdate(result.orderId, {
          paymentStatus: "Paid",
          status: "Processing",
          $push: {
            history: {
              $each: [
                {
                  event: "payment_captured",
                  status: "Paid",
                  previousStatus: prevPayment,
                  note: `Payment captured via Stripe ($${Number(result.amount || 0).toFixed(2)})`,
                  by: null,
                  at: now,
                },
                {
                  event: "status_changed",
                  status: "Processing",
                  previousStatus: prevOrder,
                  note: "Auto-advanced on payment success",
                  by: null,
                  at: now,
                },
              ],
            },
          },
        });

        // Audit log — fire-and-forget
        logStateChange(models, {
          entity: "payment",
          resourceId: result.orderId,
          from: prevPayment,
          to: "Paid",
          actor: null,
          reason: "Stripe webhook payment_intent.succeeded",
          metadata: { eventId: result.eventId, paymentIntentId: result.paymentIntentId },
        });
        logStateChange(models, {
          entity: "order",
          resourceId: result.orderId,
          from: prevOrder,
          to: "Processing",
          actor: null,
          reason: "Auto-advanced on payment success",
        });
      }

      // Create payment record
      await models.Payment.create({
        tenantId: result.tenantId,
        order: result.orderId,
        provider: "stripe",
        providerTransactionId: result.paymentIntentId,
        eventId: result.eventId,
        amount: result.amount,
        status: "completed",
      });
    } else if (result.type === "payment_failed") {
      const mongoose = (await import("mongoose")).default;
      const { createScopedModels } = await import("../utils/scopedModel.js");
      const models = createScopedModels(mongoose.connection, result.tenantId);

      // Check idempotency for failed events too
      const existingPayment = await models.Payment.findOne({ eventId: result.eventId });
      if (existingPayment) {
        return res.json({ received: true });
      }

      const order = await models.Order.findOne({ _id: result.orderId });
      if (order) {
        const prevPayment = order.paymentStatus || "Not Paid";
        try {
          guardTransition("payment", prevPayment, "Failed");
        } catch (err) {
          logger.warn("Webhook payment failure transition rejected", {
            orderId: result.orderId,
            from: prevPayment,
            reason: err.message,
          });
          return res.json({ received: true });
        }

        await models.Order.findByIdAndUpdate(result.orderId, {
          paymentStatus: "Failed",
          $push: {
            history: {
              event: "payment_failed",
              status: "Failed",
              previousStatus: prevPayment,
              note: result.error
                ? `Payment failed — ${result.error}`
                : "Payment failed",
              by: null,
              at: new Date(),
            },
          },
        });

        logStateChange(models, {
          entity: "payment",
          resourceId: result.orderId,
          from: prevPayment,
          to: "Failed",
          actor: null,
          reason: "Stripe webhook payment_intent.payment_failed",
          metadata: { eventId: result.eventId, error: result.error },
        });

        try {
          emitNotification(models, result.tenantId, {
            type: "payment.failed",
            severity: "error",
            title: "Payment failed",
            body: `Order ${order.orderNumber || result.orderId} payment failed${result.error ? ` — ${result.error}` : ""}`,
            resourceType: "payment",
            resourceId: result.orderId,
            permission: "payments.read",
            data: {
              orderNumber: order.orderNumber,
              error: result.error || null,
            },
          });
        } catch (err) {
          console.warn("emit payment.failed failed", err?.message);
        }
      }
    } else if (result.type === "payment_authorized") {
      // Manual-capture flow: authorization webhook. Record a payment row
      // (status=authorized) and bump the order's paymentStatus to
      // Authorized so the Capture action is exposed in the UI. If the
      // order is already Paid we no-op (capture already happened).
      const mongoose = (await import("mongoose")).default;
      const { createScopedModels } = await import("../utils/scopedModel.js");
      const models = createScopedModels(mongoose.connection, result.tenantId);

      const existingPayment = await models.Payment.findOne({ eventId: result.eventId });
      if (existingPayment) {
        return res.json({ received: true });
      }

      const order = await models.Order.findOne({ _id: result.orderId });
      if (order) {
        const prevPayment = order.paymentStatus || "Not Paid";
        try {
          guardTransition("payment", prevPayment, "Authorized");
        } catch (err) {
          logger.warn("Webhook payment authorization transition rejected", {
            orderId: result.orderId,
            from: prevPayment,
            reason: err.message,
          });
          return res.json({ received: true });
        }

        await models.Order.findByIdAndUpdate(result.orderId, {
          paymentStatus: "Authorized",
          $push: {
            history: {
              event: "payment_authorized",
              status: "Authorized",
              previousStatus: prevPayment,
              note: `Payment authorized via Stripe ($${Number(result.amount || 0).toFixed(2)})`,
              by: null,
              at: new Date(),
            },
          },
        });

        logStateChange(models, {
          entity: "payment",
          resourceId: result.orderId,
          from: prevPayment,
          to: "Authorized",
          actor: null,
          reason: "Stripe webhook payment_intent.amount_capturable_updated",
          metadata: { eventId: result.eventId, paymentIntentId: result.paymentIntentId },
        });

        await models.Payment.create({
          tenantId: result.tenantId,
          order: result.orderId,
          provider: "stripe",
          providerTransactionId: result.paymentIntentId,
          eventId: result.eventId,
          amount: result.amount,
          status: "authorized",
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Payment webhook error", { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    List all payment + refund records for an order. Drives the
 *          refund history panel on the order details page.
 * @access  Private (manager+)
 */
/**
 * @route   GET /api/payments
 * @desc    List payment/refund records across the tenant for the
 *          Transactions dashboard. Supports a free-text `search` over
 *          order number, transaction id, and customer email.
 * @access  Private (manager+)
 */
export const listPaymentsController = asyncHandler(async (req, res) => {
  const { search } = req.query;
  // `status` from our schema uses "completed" — the dashboard table
  // displays "succeeded", so we normalize on the way out.
  const statusMap = { completed: "succeeded" };

  let rows = await req.models.Payment.find({})
    .sort({ createdAt: -1 })
    .populate({
      path: "order",
      select: "orderNumber customerEmail shippingAddress user totalAmount",
    })
    .lean();

  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    rows = rows.filter((p) => {
      const orderNo = String(p.order?.orderNumber || "").toLowerCase();
      const txId = String(p.providerTransactionId || "").toLowerCase();
      const email = String(p.order?.customerEmail || "").toLowerCase();
      return orderNo.includes(q) || txId.includes(q) || email.includes(q);
    });
  }

  const payments = rows.map((p) => {
    const order = p.order || {};
    const shipping = order.shippingAddress || {};
    const name =
      [shipping.firstName, shipping.lastName].filter(Boolean).join(" ").trim() ||
      undefined;
    return {
      _id: p._id,
      orderId: order._id || p.order,
      orderNumber: order.orderNumber,
      amount: p.amount,
      currency: p.currency,
      status: statusMap[p.status] || p.status,
      method: p.paymentMethod || p.provider,
      provider: p.provider,
      transactionId: p.providerTransactionId,
      refundedAmount: p.refundAmount,
      customer: name || order.customerEmail
        ? { name: name || "", email: order.customerEmail || "" }
        : undefined,
      createdAt: p.createdAt,
    };
  });

  res.json({ success: true, responseObject: { payments } });
});

/**
 * @route   GET /api/payments/:id
 * @desc    Single-transaction detail for the dashboard drill-down.
 *          Returns the Payment + populated order snapshot + (when the
 *          order used a manual/cod payment method) the PaymentMethod
 *          definition so the UI can render customerFields.
 */
export const getPaymentController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await req.models.Payment.findById(id)
    .populate({
      path: "order",
      select:
        "orderNumber customerEmail customerPhone shippingAddress billingAddress user totalAmount subtotal shippingCost tax paymentMethod paymentMethodCode paymentDetails paymentStatus status createdAt paymentIntentId",
    })
    .lean();

  if (!payment) {
    return res.status(404).json({ success: false, message: "Payment not found" });
  }

  let paymentMethodDef = null;
  const methodCode = payment.order?.paymentMethodCode;
  if (methodCode) {
    // Do not select `+config` — gateway credentials (API keys, webhook
    // secrets) live there and don't belong in a payment detail response.
    paymentMethodDef = await req.models.PaymentMethod.findOne({ code: methodCode }).lean();
  }

  // Related payments for the same order give context (e.g. this refund
  // row belongs to which original capture, or vice versa).
  const related = payment.order?._id
    ? await req.models.Payment.find({
        order: payment.order._id,
        _id: { $ne: payment._id },
      })
        .sort({ createdAt: 1 })
        .lean()
    : [];

  res.json({
    success: true,
    responseObject: {
      payment,
      paymentMethodDef,
      related,
    },
  });
});

export const listOrderPaymentsController = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await req.models.Order.findById(orderId).select("_id totalAmount paymentStatus");
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  const payments = await req.models.Payment.find({ order: orderId }).sort({ createdAt: 1 });
  const totalRefunded = payments
    .filter((p) => p.status === "refunded")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  res.json({
    success: true,
    data: {
      payments,
      totalPaid,
      totalRefunded,
      maxRefundable: Math.max(0, order.totalAmount - totalRefunded),
    },
  });
});

/**
 * @route   POST /api/payments/refund
 * @desc    Refund a payment. Stripe-backed when the order has a
 *          paymentIntentId; otherwise (Cash on Delivery, bank transfer,
 *          store credit, anything else) records a manual refund marker
 *          so the order ledger stays accurate without hitting Stripe.
 * @access  Private (manager+). Refunds are a day-to-day support
 *          operation and sit alongside order cancel / fulfillment
 *          management, so managers can issue them — same gate as the
 *          rest of the order lifecycle endpoints.
 */
/**
 * @route   POST /api/payments/verify-manual
 * @desc    Merchant-side verification for manual payment methods (bank
 *          transfer, crypto, etc.). Marks the order as Paid after the
 *          merchant has confirmed the customer's submitted payment
 *          details (receipt, transaction id, ...). No external provider
 *          call — this is the manual equivalent of a webhook succeeded
 *          event. Creates a Payment row with provider="manual".
 * @access  Private (manager+)
 */
export const verifyManualPaymentController = asyncHandler(async (req, res) => {
  const { orderId, note } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ success: false, message: "orderId is required" });
  }

  const order = await req.models.Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Only manual/COD flows go through this endpoint. A stripe-intent order
  // must be captured via webhook or the dashboard capture UI.
  if (order.paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: "Order is a gateway payment — use the gateway capture flow.",
    });
  }

  const prevPaymentStatus = order.paymentStatus || "Not Paid";
  const prevOrderStatus = order.status || "Pending";

  guardTransition("payment", prevPaymentStatus, "Paid");

  const now = new Date();
  // Auto-advance Pending → Processing on payment, mirroring webhook behavior.
  const willAdvanceOrder = prevOrderStatus === "Pending";
  if (willAdvanceOrder) {
    guardTransition("order", prevOrderStatus, "Processing");
  }

  const update = {
    paymentStatus: "Paid",
    updatedAt: now,
  };
  if (willAdvanceOrder) update.status = "Processing";

  // Conditional update — only flip to Paid if the row is still at
  // prevPaymentStatus. Two admins hitting "Verify" simultaneously: the
  // second one sees matchedCount=0 and gets the 409 below instead of
  // creating a duplicate Payment row.
  const updateResult = await req.models.Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: prevPaymentStatus },
    {
      $set: update,
      $push: {
        history: {
          event: "manual_payment_verified",
          note: note
            ? `Manual payment verified — ${note}`
            : "Manual payment verified by merchant",
          by: req.user?.userId || null,
          at: now,
        },
      },
    },
    { new: false }
  );
  if (!updateResult) {
    return res.status(409).json({
      success: false,
      message: "Order payment status changed — refresh and try again.",
    });
  }

  const verifyTxnId = `manual-verify-${orderId}-${Date.now()}`;
  await req.models.Payment.create({
    tenantId: req.tenantId,
    order: orderId,
    provider: "manual",
    providerTransactionId: verifyTxnId,
    // The compound sparse index on (tenantId, eventId) still indexes
    // docs where only eventId is missing — so every row must carry a
    // unique eventId or the second manual payment collides. Reuse the
    // manual txn id to satisfy uniqueness without migrating indexes.
    eventId: verifyTxnId,
    amount: order.totalAmount,
    status: "completed",
    paymentMethod: order.paymentMethod,
    metadata: {
      manual: true,
      verifiedBy: req.user?.userId || null,
      note: note || undefined,
      customerDetails: order.paymentDetails || undefined,
    },
  });

  logStateChange(req.models, {
    entity: "payment",
    resourceId: orderId,
    from: prevPaymentStatus,
    to: "Paid",
    actor: req.user?.userId || null,
    reason: "Manual payment verified",
    metadata: { note },
  });
  if (willAdvanceOrder) {
    logStateChange(req.models, {
      entity: "order",
      resourceId: orderId,
      from: prevOrderStatus,
      to: "Processing",
      actor: req.user?.userId || null,
      reason: "Auto-advanced on manual verification",
    });
  }

  res.json({
    success: true,
    data: { paymentStatus: "Paid", status: willAdvanceOrder ? "Processing" : order.status },
  });
});

export const refundController = asyncHandler(async (req, res) => {
  const { orderId, amount, reason, manual, refundDetails } = req.body;

  const order = await req.models.Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Legacy backfill: orders created before `refundedAmount` was added to
  // the schema have it as undefined. Compute it from the Payment ledger
  // once and persist — conditional on the field still being missing so
  // concurrent requests can't clobber each other's backfill.
  if (order.refundedAmount === undefined || order.refundedAmount === null) {
    const existingRefunds = await req.models.Payment.find({
      order: orderId,
      status: "refunded",
    }).select("amount").lean();
    const computed = existingRefunds.reduce((sum, p) => sum + (p.amount || 0), 0);
    await req.models.Order.updateOne(
      { _id: orderId, refundedAmount: { $in: [null, undefined] } },
      { $set: { refundedAmount: computed } }
    );
    order.refundedAmount = computed;
  }

  const totalRefunded = order.refundedAmount || 0;
  const maxRefundable = order.totalAmount - totalRefunded;

  if (maxRefundable <= 0) {
    return res.status(400).json({ success: false, message: "Order has already been fully refunded" });
  }

  const refundAmount = amount ? Math.min(amount, maxRefundable) : maxRefundable;

  // Decide path: Stripe if we have an intent and the caller didn't force
  // manual; otherwise record a manual refund row. COD / bank transfer /
  // store credit orders land here.
  const useManual = manual === true || !order.paymentIntentId;

  if (!useManual && !isStripeConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Stripe is not configured. Pass { manual: true } to record a non-Stripe refund.",
    });
  }

  // Determine correct payment status based on cumulative refunds
  const newPaymentStatus =
    (totalRefunded + refundAmount) >= order.totalAmount
      ? "Refunded"
      : "Partially Refunded";

  // Guard only the payment lifecycle — refunds are a payment-status
  // concern. The operational order.status (Processing / Shipped / …) is
  // left untouched so a merchant can refund a still-in-flight order
  // without violating the order state machine.
  const prevPaymentStatus = order.paymentStatus || "Not Paid";
  guardTransition("payment", prevPaymentStatus, newPaymentStatus);

  // Reserve the refund slot atomically BEFORE calling any external
  // provider. Two admins hitting Refund in parallel: the second one
  // sees matchedCount=0 and gets a 409 without Stripe ever being charged
  // twice. $expr runs server-side on the pre-update document. If the
  // provider call fails afterwards we revert the $inc below.
  const now = new Date();
  const orderUpdateResult = await req.models.Order.findOneAndUpdate(
    {
      _id: orderId,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$refundedAmount", 0] }, refundAmount] },
          "$totalAmount",
        ],
      },
    },
    {
      $set: {
        paymentStatus: newPaymentStatus,
        updatedAt: now,
      },
      $inc: { refundedAmount: refundAmount },
      $push: {
        history: {
          event: useManual ? "manual_refund" : "refund_issued",
          note: `${useManual ? "Manual" : "Stripe"} refund of $${refundAmount.toFixed(2)}${
            reason ? ` — ${reason}` : ""
          }`,
          by: req.user?.userId || null,
          at: now,
        },
      },
    },
    { new: false }
  );
  if (!orderUpdateResult) {
    return res.status(409).json({
      success: false,
      message: "Refund would exceed order total — another refund may have just been recorded. Refresh and try again.",
    });
  }

  let providerResult = null;
  let providerTransactionId = null;
  let provider = "manual";

  if (useManual) {
    // Manual refund — no external call. Provider stays "manual" to
    // satisfy the payment schema enum; the original payment method
    // ("Cash on Delivery" etc.) is preserved in metadata so the UI can
    // render "Cash refund" even for non-Stripe orders. randomUUID avoids
    // Date.now() collisions when two refunds land in the same ms.
    provider = "manual";
    providerTransactionId = `manual-${crypto.randomUUID()}`;
  } else {
    try {
      providerResult = await createRefund(order.paymentIntentId, refundAmount);
      providerTransactionId = providerResult.refundId;
      provider = "stripe";
    } catch (err) {
      // Roll back the reservation — Stripe didn't take the money, so the
      // order's refundedAmount must not stay bumped. Best-effort: if the
      // revert itself fails we'll need to reconcile manually, but the
      // alternative (leaving the order in Refunded state with no Payment
      // row) is worse.
      await req.models.Order.updateOne(
        { _id: orderId },
        {
          $inc: { refundedAmount: -refundAmount },
          $set: {
            paymentStatus: prevPaymentStatus,
          },
          $push: {
            history: {
              event: "refund_failed",
              note: `Stripe refund of $${refundAmount.toFixed(2)} rejected — ${err?.message || "provider error"}`,
              by: req.user?.userId || null,
              at: new Date(),
            },
          },
        }
      );
      return res.status(502).json({
        success: false,
        message: "Refund provider rejected the request — no charge made.",
        error: err?.message || String(err),
      });
    }
  }

  // Audit log — fire-and-forget
  logStateChange(req.models, {
    entity: "payment",
    resourceId: orderId,
    from: prevPaymentStatus,
    to: newPaymentStatus,
    actor: req.user?.userId || null,
    reason: useManual ? "Manual refund" : "Stripe refund",
    metadata: { amount: refundAmount, reason },
  });
  if (newPaymentStatus === "Refunded" && order.status !== "Refunded") {
    logStateChange(req.models, {
      entity: "order",
      resourceId: orderId,
      from: order.status,
      to: "Refunded",
      actor: req.user?.userId || null,
      reason: "Full refund issued",
    });
  }

  // Create payment record for refund
  await req.models.Payment.create({
    tenantId: req.tenantId,
    order: orderId,
    provider,
    providerTransactionId,
    // Give manual refunds a unique eventId — compound sparse index on
    // (tenantId, eventId) otherwise collides on null across rows.
    eventId: useManual ? providerTransactionId : undefined,
    amount: refundAmount,
    status: "refunded",
    paymentMethod: order.paymentMethod,
    metadata: {
      manual: useManual,
      reason: reason || (useManual ? "Manual refund" : undefined),
      refundDetails:
        useManual && refundDetails && typeof refundDetails === "object"
          ? refundDetails
          : undefined,
    },
  });

  try {
    emitNotification(req.models, req.tenantId, {
      type: "refund.created",
      severity: "info",
      title: "Refund issued",
      body: `$${refundAmount.toFixed(2)} refunded on order ${order.orderNumber || orderId}${reason ? ` — ${reason}` : ""}`,
      resourceType: "payment",
      resourceId: orderId,
      permission: "payments.read",
      data: {
        orderNumber: order.orderNumber,
        refundAmount,
        manual: useManual,
        reason: reason || null,
      },
    });
  } catch (err) {
    console.warn("emit refund.created failed", err?.message);
  }

  res.json({
    success: true,
    data: {
      ...(providerResult || {}),
      refundAmount,
      totalRefunded: totalRefunded + refundAmount,
      manual: useManual,
    },
  });
});

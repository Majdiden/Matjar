Order Page Improvements

1. Top-Level Next Action Area

Add a decision/action strip directly under the order title. It should compute the most important operational
action based on the order state.

Examples:

- If paymentStatus = unpaid and paymentMethod = cod: show Mark as paid, Cancel order.
- If paymentStatus = authorized: show Capture payment, Void authorization.
- If fulfillmentStatus = unfulfilled: show Create fulfillment, Print packing slip.
- If fulfillmentStatus = partially_fulfilled: show Fulfill remaining.
- If orderStatus = cancelled: show read-only cancellation summary.

Acceptance criteria:

- Only valid actions appear for the current order state.
- Dangerous actions require confirmation.
- Action buttons explain why they are disabled when unavailable.
- Every action writes an audit/timeline event.

2. Stronger Status Model

Separate order status, payment status, and fulfillment status. Do not overload one Pending label.

Recommended fields:

orderStatus: pending | confirmed | processing | completed | cancelled | archived
paymentStatus: unpaid | authorized | paid | partially_refunded | refunded | voided | failed
fulfillmentStatus: unfulfilled | partially_fulfilled | fulfilled | returned | cancelled

The UI should show all three near the top.

Acceptance criteria:

- Order, payment, and fulfillment status are visibly separate.
- Status colors communicate severity.
- Status transitions are validated server-side.
- Invalid transitions are rejected, not hidden only in UI.

3. Payment Action Panel

The payment card should not only display Not Paid. It should expose valid payment operations.

For COD:

- Mark as paid
- Mark as failed
- Cancel unpaid order

For card/manual provider payments:

- Capture
- Void authorization
- Refund
- Record manual payment, if supported

For refunds:

- Refund full
- Refund partial
- Record manual refund
- Require refund reason.
- Require refund amount validation.

Acceptance criteria:

- Refund cannot exceed paid minus already refunded.
- Manual refund cannot be recorded if nothing was paid unless explicitly allowed as adjustment.
- Every payment/refund has amount, currency, method, reference, reason, actor, timestamp.
- Payment status is derived from payment records where possible, not manually guessed.

4. Fulfillment Workflow

Add a dedicated fulfillment card for shipment operations.

It should support:

- Create fulfillment for one or more line items.
- Partial fulfillment.
- Tracking number.
- Carrier.
- Fulfillment provider.
- Shipment status.
- Notify customer toggle.
- Print packing slip.
- Mark as delivered, if manual provider.

Data model should support multiple fulfillments per order:

fulfillments: [
{
id,
providerId,
status,
trackingNumber,
trackingUrl,
carrier,
items: [
{ orderItemId, quantity }
],
createdBy,
createdAt,
updatedAt
}
]

Acceptance criteria:

- A line item cannot be fulfilled beyond purchased quantity.
- Partial fulfillment is supported.
- Fulfilled quantity is computed per item.
- Fulfillment status updates the order-level fulfillment status.
- Fulfillment events appear in timeline.
- Tracking info is visible to the customer when appropriate.

5. Order Item Operational Detail

The item list should expose more than name and price.

Add:

- SKU
- Variant title/options
- Quantity
- Unit price
- Line subtotal
- Discount allocation
- Tax allocation
- Fulfilled quantity
- Refunded quantity
- Returnable quantity
- Inventory source/location later if needed

Recommended display:

iPhone 15 Pro
SKU: APL-I15P-NATURAL-TITANIUM-512GB
Variant: Color: Natural Titanium / Storage: 512GB
Qty: 1
Fulfilled: 0 / 1
Refunded: 0 / 1

Acceptance criteria:

- Variant identity is clear.
- Refund/fulfillment actions operate on item quantities, not only full order.
- Line totals match checkout calculations.
- Item-level status is derived from fulfillment/refund records.

6. Timeline Expansion

The timeline should become the audit/event feed for the order.

Include events for:

- Order placed
- Payment authorized
- Payment captured
- Payment failed
- Payment marked paid manually
- Fulfillment created
- Tracking added
- Fulfillment delivered
- Order status changed
- Refund created
- Refund failed
- Customer notified
- Staff note added
- Order cancelled
- Address edited
- Discount adjusted

Event shape:

{
type,
message,
actorType: system | staff | customer | integration,
actorId,
metadata,
createdAt
}

Acceptance criteria:

- Every business-critical mutation writes a timeline event.
- Events include actor and timestamp.
- Sensitive metadata is redacted.
- Timeline is append-only.
- Staff can filter or collapse noisy events later.

7. Internal Notes

Add internal staff notes on the order page.

Features:

- Add note.
- Edit own note for limited time, or never edit depending on policy.
- Delete only with permission, or soft-delete.
- Pin important note.
- Mention staff later if needed.

Data model:

notes: [
{
id,
body,
createdBy,
createdAt,
updatedAt,
deletedAt,
pinned
}
]

Acceptance criteria:

- Notes are never visible to customers.
- Notes are tenant-scoped.
- Notes are included in audit/timeline when created/deleted.
- Notes support plain text only initially to avoid XSS risk.

8. Customer Context Card

The customer card should help support and operations make decisions.

Add:

- Customer type: guest/customer
- Lifetime order count
- Lifetime spend
- Previous refunds
- Previous cancellations
- Last order date
- Customer since
- Marketing consent
- Link to customer profile
- View all orders

Acceptance criteria:

- Guest customers are handled cleanly.
- Data is tenant-scoped.
- Lifetime stats exclude cancelled/unpaid orders where appropriate.
- Staff can navigate to the customer profile/order history.

9. Shipping And Billing Address Cards

Add separate cards for shipping and billing.

Shipping card:

- Recipient name
- Phone
- Address lines
- City/state/postal/country
- Delivery instructions
- Edit address action, if allowed before fulfillment

Billing card:

- Billing name
- Billing address
- Same as shipping indicator

Acceptance criteria:

- Address edits are blocked after fulfillment unless staff has permission.
- Address edits write timeline events.
- Customer notification is optional.
- Address data is displayed exactly as used at checkout, not pulled live from the customer profile after the
  order is placed.

10. Tags And Workflow Labels

Add order tags for merchant-specific workflows.

Examples:

- VIP
- Urgent
- Fraud Review
- Wholesale
- Pickup
- High Value
- Needs Call
- Replacement

Implementation:

tags: string[]

Later you can move to structured tags:

{
id,
name,
color,
tenantId
}

Acceptance criteria:

- Tags are tenant-scoped.
- Tags can be added/removed by authorized staff.
- Tags are filterable in the order list.
- Tag changes write timeline events.
- Tag names are length-limited and sanitized.

11. deleted

12. Permissions And Role Enforcement

Order actions should be permission-controlled.

Suggested scopes:

orders.read
orders.update_status
orders.cancel
payments.capture
payments.refund
payments.record_manual
fulfillments.create
fulfillments.update
orders.notes.write
orders.tags.write
customers.read

Acceptance criteria:

- UI hides unavailable actions.
- Backend enforces permissions independently.
- Unauthorized mutation attempts return 403.
- Permission failures are logged.

13. State Transition Rules

Define server-side transition guards.

Example:

pending -> confirmed -> processing -> completed
pending -> cancelled
confirmed -> cancelled
processing -> completed

Payment rules:

unpaid -> paid
authorized -> paid
authorized -> voided
paid -> partially_refunded
paid -> refunded

Fulfillment rules:

unfulfilled -> partially_fulfilled -> fulfilled
unfulfilled -> cancelled
fulfilled -> returned

Acceptance criteria:

- Invalid transitions are rejected.
- Transitions are centralized in service logic.
- Tests cover every valid and invalid transition.
- Timeline event is created after successful transition only.

14. Print And Documents

You already have Print and Invoice. Add document correctness.

Documents to support:

- Invoice
- Packing slip
- Refund receipt
- Order confirmation
- Shipping label later

Acceptance criteria:

- Invoice totals match order totals exactly.
- Invoice includes merchant legal/company info.
- Invoice includes tax lines if applicable.
- Packing slip excludes prices by default.
- Documents use immutable order snapshot data.

15. Order Snapshot Integrity

Enterprise order pages must not depend on mutable product/customer data for historical truth.

Order should store snapshots:

items: [
{
productId,
variantId,
titleSnapshot,
skuSnapshot,
variantSnapshot,
imageSnapshot,
unitPriceSnapshot,
taxSnapshot,
discountSnapshot
}
],
customerSnapshot,
shippingAddressSnapshot,
billingAddressSnapshot

Acceptance criteria:

- Changing product title after purchase does not alter old order display.
- Changing customer profile does not alter old order address/contact snapshot.
- Order totals are immutable unless explicit adjustment is recorded.
- Invoice uses snapshots, not current product/customer records.

16. Reliability And Concurrency

Important for refunds, fulfillment, and status changes.

Add guards for:

- Double refund click
- Double fulfillment submission
- Concurrent status update
- Stale order version

Recommended approach:

- Use atomic updates for money/quantity changes.
- Use idempotency keys for payment/refund/fulfillment actions.
- Store version or use Mongoose optimistic concurrency where appropriate.

Acceptance criteria:

- Same refund request cannot apply twice.
- Fulfilled quantity cannot exceed ordered quantity under concurrent requests.
- Payment capture cannot happen twice.
- Failed external calls do not leave order in inconsistent state.

Priority Order

If you want to implement this properly, I would tackle it in this sequence:

1. Split and enforce orderStatus, paymentStatus, fulfillmentStatus.
2. Add timeline/audit events for all order mutations.
3. Add payment/refund action model with strict amount validation.
4. Add fulfillment model with line-item quantities.
5. Add shipping/billing address cards and immutable snapshots.
6. Add internal notes and tags.
7. Add customer history context.
8. Add basic risk signals.
9. Improve print/invoice/packing slip correctness.
10. Add permission scopes and tests around every action.

The key principle: the order page should not just display an order. It should be the operational control center
for payment, fulfillment, customer support, audit, and exceptions.

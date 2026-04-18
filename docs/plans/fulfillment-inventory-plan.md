• If you want the platform to be integration-ready, keep the current fulfillment/
order work, but introduce a proper integration layer before adding providers. Do
not wire ShipBob/ShipStation/FBA/etc. directly into order controllers or product
inventory logic.

Your current code is moving in the right direction, but integrations are still not
structurally ready.

Current State

Good signs:

- Domain events exist in services/events.js.
- Webhook schema exists in schemas/store/webhook.js.
- Fulfillments are now modeled more seriously inside schemas/store/order.js.
- Fulfillment management routes/controllers exist in routes/fulfillment.js and
  controllers/fulfillment.js.
- Markets, companies, custom fields, audit logs, and structured setup state now
  exist.

Still not integration-ready:

- services/webhookDispatcher.js is still placeholder-level.
- Fulfillments are embedded in orders, which is fine for MVP, but awkward for
  provider integrations that need independent retries, external IDs, sync state,
  error state, and webhook reconciliation.
- There is no provider adapter contract yet.
- There is no Location, FulfillmentProvider, InventoryItem, InventoryLevel, or
  InventoryReservation model.
- Inventory is still mostly product/variant stock, which limits provider sync and
  multi-warehouse routing.
- Domain registration is still placeholder in services/domainRegistration.js.

What Integration-Ready Should Mean

For your platform, “ready for integrations” means every external provider should
plug into stable internal contracts.

You want providers to adapt to your platform, not your platform to adapt to every
provider.

The core contracts should be:

Catalog Provider
Inventory Provider
Fulfillment Provider
Shipping Rate Provider
Payment Provider
Tax Provider
Domain/DNS Provider
Notification Provider
Webhook/Event Provider

Each provider should have:

- capabilities
- credentialsRef
- connect/testConnection
- sync
- createExternalResource
- handleWebhook
- retry/reconcile
- disconnect

Recommended Models To Add Before Provider Integrations

1. IntegrationProvider

Tenant-level installed integration.

{
tenantId,
type: "fulfillment" | "shipping" | "inventory" | "tax" | "domain" | "email",
provider: "shipbob" | "shipstation" | "amazon_mcf" | "easypost" | "manual",
name,
status: "active" | "inactive" | "error",
credentialsRef,
capabilities: {
inventorySync: true,
orderPush: true,
trackingWebhooks: true,
rates: false,
returns: false
},
settings: {},
lastSyncAt,
error
}

2. IntegrationCredential

Do not store provider secrets directly in tenant/provider docs.

{
tenantId,
provider,
encryptedPayload,
keyVersion,
createdAt,
rotatedAt
}

3. Location

Physical or virtual fulfillment location.

{
tenantId,
name,
type: "merchant" | "third_party" | "dropship" | "virtual",
provider,
providerLocationId,
address,
countriesServed,
priority,
isActive
}

4. InventoryItem

A stockable SKU independent from product document structure.

{
tenantId,
product,
variantId,
sku,
barcode,
tracked,
requiresShipping,
weight,
customs
}

5. InventoryLevel

Inventory per location/provider.

{
tenantId,
inventoryItem,
location,
available,
reserved,
committed,
incoming,
safetyStock,
providerSyncedAt
}

6. InventoryReservation

Created during checkout/order placement.

{
tenantId,
order,
cart,
inventoryItem,
location,
quantity,
status: "active" | "committed" | "released" | "expired",
expiresAt
}

7. FulfillmentOrder

Make this a top-level model before serious provider integrations.

{
tenantId,
order,
location,
provider,
status: "open" | "submitted" | "accepted" | "in_progress" | "shipped" |
"cancelled" | "failed",
items: [
{
orderLineId,
inventoryItem,
sku,
quantity
}
],
providerOrderId,
providerPayload,
error,
submittedAt,
acceptedAt,
shippedAt
}

8. Shipment

Provider tracking results.

{
tenantId,
fulfillmentOrder,
order,
provider,
trackingNumber,
carrier,
trackingUrl,
status: "label_created" | "in_transit" | "delivered" | "failed",
items,
shippedAt,
deliveredAt
}

9. IntegrationJob

Every external call should be durable and retryable.

{
tenantId,
provider,
type: "submit_fulfillment" | "sync_inventory" | "pull_tracking" |
"webhook_delivery",
status: "queued" | "running" | "succeeded" | "failed" | "dead",
attempts,
maxAttempts,
payload,
result,
error,
runAfter,
idempotencyKey
}

Provider Adapter Contract

Create something like:

class FulfillmentProviderAdapter {
async testConnection() {}
async getLocations() {}
async pushFulfillmentOrder(fulfillmentOrder) {}
async cancelFulfillmentOrder(providerOrderId) {}
async getFulfillmentStatus(providerOrderId) {}
async handleWebhook(payload, headers) {}
}

Then each provider implements it:

services/integrations/fulfillment/ShipBobProvider.js
services/integrations/fulfillment/ShipStationProvider.js
services/integrations/fulfillment/AmazonMcfProvider.js
services/integrations/fulfillment/ManualFulfillmentProvider.js

Do not let controllers know provider-specific logic.

How This Affects Your Current Fulfillment Model

Your current embedded order.fulfillments[] is useful for dashboard display, but
for integrations I would treat it as one of two things:

Option A: Keep embedded fulfillments as display snapshots

- Real operational fulfillment lives in FulfillmentOrder.
- Order embeds a summary for fast reads.

Option B: Migrate entirely to top-level FulfillmentOrder

- Cleaner for provider integrations.
- Easier retries, querying, webhooks, and reconciliation.
- Better long-term choice.

I recommend option B if integrations are a priority.

Inventory Recommendation

Do not delete inventory permanently.

Instead:

- Stop investing in the old Inventory schema shape.
- Use current product/variant stock only as MVP source.
- Add future-ready InventoryItem, InventoryLevel, and InventoryReservation.
- Eventually make Product.stock and variants[].stock derived/cache fields.

Event/Webhook Recommendation

Your current services/events.js is in-memory. That is fine for local MVP, but not
integration-grade.

Integration-ready events should be durable:

Domain event emitted
-> Event persisted
-> Integration jobs created
-> Jobs retried with idempotency
-> Results recorded
-> Dead-letter after max attempts

You need:

- persisted event log
- webhook subscriptions
- delivery attempts
- HMAC signing
- retry schedule
- dead-letter state
- admin visibility

Suggested Build Order

1. Create integration foundation

- IntegrationProvider
- IntegrationCredential
- IntegrationJob
- provider adapter interfaces
- encrypted credential storage

2. Create fulfillment foundation

- Location
- InventoryItem
- InventoryLevel
- InventoryReservation
- top-level FulfillmentOrder
- Shipment

3. Refactor order placement

- Reserve inventory from InventoryLevel
- Create order
- Commit reservation
- Create fulfillment orders
- Queue provider submission jobs

4. Build provider system

- Manual provider first
- Then one real provider, e.g. ShipStation or ShipBob
- Add webhook ingestion
- Add reconciliation jobs

5. Expose tenant admin UX/API

- Connect provider
- Test connection
- Choose default provider
- Configure routing rules
- View sync errors
- Retry failed jobs

Immediate Recommendation

For now, do this:

- Keep current product/variant stock working.
- Mark old Inventory collection as legacy.
- Do not delete inventory concept.
- Start adding integration-ready models alongside the current flow.
- Migrate checkout/order fulfillment onto those models before adding real
  providers.

This avoids overbuilding today while preventing a painful rewrite when fulfillment
integrations start.

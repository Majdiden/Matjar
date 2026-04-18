Main Problems
The current implementation is not durable or fully reliable.

1. Notifications are not persisted server-side

Read/unread state only lives in browser localStorage. If the user changes browser/
device, clears storage, or another staff member reads it, the backend has no idea.

That means this is not a real notification inbox. It is just a local alert cache.

2. It can miss orders

The polling endpoint returns orders newer than since, then returns serverTime.

If an order is created after the DB query starts but before serverTime is
generated, the client can advance since past that order and never see it.

This is a classic polling cursor race. It is small, but real.

3. It can duplicate alerts across tabs

Every open dashboard tab runs its own polling loop. If a merchant has three
dashboard tabs open, each one can fire its own toast, sound, and browser
notification.

There is no BroadcastChannel, localStorage coordination, or leader election to
make only one tab poll.

4. The endpoint returns full order documents

The client only needs \_id, orderNumber, totalAmount, currency, customer display
name, and createdAt.

But services/order.js:972 returns full lean order documents. That can expose
unnecessary fields and wastes bandwidth.

5. Permission gate is softer than it should be

The route is authenticated, but it does not explicitly use
requirePermission("orders.read") in routes/order.js:49.

The service filters users without orders.read to their own orders, but this
endpoint is dashboard-specific. I would gate it explicitly with orders.read.

6. It is only “new order” notifications

The code and naming imply general notifications, but it only supports new orders.
It does not support low stock, payment verification needed, failed payment, return
requested, domain/SSL issues, staff invite accepted, webhook failures, etc.

Best Direction
For production, I would replace this with a real notification event model:

- Add Notification schema:
  - tenantId
  - type
  - title
  - body
  - resourceType
  - resourceId
  - severity
  - createdAt
  - readBy: [{ userId, readAt }] or per-recipient rows
  - recipientRole / recipientUserIds / permission
- Write notification rows when events happen:
  - order created
  - manual payment submitted
  - low stock
  - refund created
  - webhook failed
  - domain verification failed/succeeded
- Expose:
  - GET /notifications?cursor=...
  - PATCH /notifications/:id/read
  - POST /notifications/read-all
- Use cursor pagination, not createdAt > since.
- Push realtime via SSE or WebSocket later.
- Keep polling as fallback.

For this app, I’d use SSE first, not WebSockets. Notifications are mostly server-
to-client, so SSE is simpler and fits better. Keep the current polling as fallback
for unsupported/disconnected cases.

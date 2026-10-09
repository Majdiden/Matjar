# PBI-11: Permanent store deletion from the platform console

[View in Backlog](../backlog.md#user-content-11)

## Overview

Deleting a store from the platform console only ever archived it: "schedule deletion" closes the store, and after the grace period the sweep wipes part of its data but keeps the Tenant row as a tombstone. The console's "Purge" was owner-only and refused archived stores. The operator needs to remove test and abandoned stores completely, from the store page and in bulk, with the power limited to trusted staff.

## Problem Statement

- Archived stores can never be removed, and their hostnames stay taken.
- The existing purge wiped a hard-coded list of 20 collections, 3 of which don't exist. About 22 store collections (pages, menus, collections, gift cards, staff invites, roles, tokens, credentials…) were never wiped, and neither were domains, merchant logins, exports or uploaded files.
- Only the owner role could purge; there was no way to delegate it to a specific person.

## User Stories

- As the platform owner, I want to permanently delete a store (including an archived one) so that test and abandoned stores and their data are gone.
- As the platform owner, I want to delete several stores at once from the tenants list.
- As the platform owner, I want to allow or stop specific staff permanently deleting stores; nobody else gets it by default.
- As the platform owner, I want every permanent deletion to require the operator's password and to be audited and emailed to owners.

## Technical Approach

- **Permission**: new scope `tenant.delete`. The OWNER role holds it; it is excluded from ADMIN (`OWNER_ONLY_GRANTS`) and every other role. An owner grants or revokes it per person as an explicit `platformScopes` entry via `PATCH /api/platform/users/:id/store-deletion` (owner role + fresh re-auth). Scopes are resolved from the database on every request, so revoking it takes effect immediately.
- **Password confirmation**: `middlewares/platformPasswordConfirm.js`. The operator's current password must be in the request body. It is checked with bcrypt (with a dummy hash to equalise timing), rate-limited to 5 failures per 15 minutes per operator, audited and alerted on failure, and stripped from the body before anything can log it. Wrong passwords return 400, so a typo doesn't sign the operator out.
- **Endpoints**:
  - `POST /api/platform/tenants/:tenantId/delete-permanently` takes `{ confirmSlug, reason, password }`.
  - `POST /api/platform/bulk/tenants/delete-permanently` takes `{ tenantIds ≤ 20, reason, confirmation: "delete N stores", password }`. It is deliberately not one of the reversible bulk actions.
- **Deletion** (`services/tenantDeletion.js`) runs in this order: mark the store inactive → delete its Domain rows (it stops serving and the hostname is freed) → delete files (`services/tenantFilePurge.js`: Cloudinary folder prefixes for the store's domain/slug/custom domain, media-library assets by id, export files, dev-mode local files) → every collection in `TENANT_SCOPED_MODELS` → admin rows that only exist for the store (merchant TenantUser rows, legacy Subscription, TenantExport, Feature/Pricing overrides, StorefrontHealth, usage snapshots, feedback, incident references) → the Tenant row last.
- **Resumable rather than transactional.** Each step is an idempotent deleteMany, and the Tenant row is only removed once every database step succeeds. A failure leaves the store listed as deleted, and running the action again finishes it.
- **Safety rails.** The wipe refuses anything that isn't a real ObjectId (an undefined id would otherwise become an empty filter and match every store). Storage prefixes accept only hostname-like identifiers and always end in "/".
- **Retained on purpose**: `PlatformAuditLog`, `BillingStatement`, `PlatformFeeEvent` and `PlanChange`. These are the platform's own ledger and financial records, and they reference the store by id only.
- **Lifecycle purge** (grace-period sweep) now reuses the same full collection wipe instead of its partial hard-coded list. It still keeps the tombstone.
- **Audit & alerts**: one `tenant.delete_permanently` audit row per store (counts, file results, failed steps, retained records), one `bulk.tenants` summary row for bulk runs, and a new `tenant.deleted_permanently` email event that owners always receive.

## UX/UI Considerations

- The store page shows "Delete permanently" to staff holding the scope, including on archived stores. They type the store's slug, give a reason and enter their password. The dialog adds an extra warning when the store is still open, and states what is kept.
- The tenants list bulk bar shows a separate "Delete…" button with its own dialog: the store list with each store's state, a warning for open stores, the reason, "delete N stores" typed back, the password, and per-store results.
- The staff page lets an owner allow or stop each non-owner from deleting stores, with re-auth, and shows a "can delete stores" badge on people who have been granted it.

## Acceptance Criteria

1. Admins and other roles can't delete stores unless an owner grants it; owners can. Grant and revoke are owner-only and take effect immediately.
2. Every deletion requires the operator's correct password and a typed confirmation; wrong input changes nothing.
3. After deletion, the store's Tenant row, domains, merchant logins and every scoped collection are gone; the hostname is available again; other stores and platform staff are untouched; the audit row exists and contains no password.
4. Bulk deletion handles up to 20 stores, reports per-store outcomes, and continues past failures.

## Related Tasks

See [tasks.md](./tasks.md).

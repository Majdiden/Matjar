# Migrations

Tracked, ordered, reversible MongoDB schema/data migrations for the Matjar
e-commerce platform.

## Why not `migrate-mongo`?

`migrate-mongo` is the industry default but ships more features than this
project needs, forces its own config file layout, and doesn't integrate
with `config/index.js`. The hand-rolled runner in `scripts/migrate.js` is
~250 lines, has zero new dependencies, and uses the same `logger` /
`config` singletons as the rest of the app.

## Directory layout

```
migrations/
  001_baseline.js          ← no-op marker for environments born pre-2026-04-18
  002_add_foo_to_products.js
  003_backfill_order_fulfillment.js
  ...
scripts/
  migrate.js               ← the runner
```

Each migration file exports:

```js
export const description = "short human-readable summary";
export async function up(db, { logger, session }) { /* apply */ }
export async function down(db, { logger, session }) { /* revert */ }
```

`db` is a native MongoDB driver database handle (from
`mongoose.connection.db`). `session` is a transaction session that is
`null` on standalone MongoDB (dev laptops without a replica set) and a
real session on Atlas / any replica-set deployment. Pass it into driver
calls via `{ session }` when it's non-null so the migration runs
atomically.

State is stored in the `_migrations` collection:

```
{ _id: "001", name: "baseline", appliedAt: <Date>, checksum: <sha256 hex> }
```

## Commands

```bash
npm run migrate:status        # list applied + pending
npm run migrate               # apply every pending migration in order
npm run migrate:down          # revert the most recently applied migration
npm run migrate:create my_change   # scaffold migrations/00N_my_change.js
```

In production the `up` and `down` commands refuse to run unless you pass
`--production`:

```bash
NODE_ENV=production node scripts/migrate.js up --production
```

Use the convenience script when doing a manual post-deploy remediation:

```bash
npm run migrate:production
```

## Writing a migration

```bash
npm run migrate:create add_inventory_tracked
# → migrations/002_add_inventory_tracked.js scaffolded
```

Fill in the `description`, `up`, and `down` functions. Keep them:

- **Idempotent** where possible. Prefer `{ $set: ... }` on docs that don't
  have the field yet (`{ field: { $exists: false } }`) over unconditional
  writes.
- **Small**. One conceptual change per file.
- **Reversible**. Write `down` at the same time as `up`. If a change is
  genuinely irreversible (destructive data deletion, for instance),
  write a `down` that throws with a clear message.
- **Respectful of `session`**. Always do `session ? { session } : undefined`
  when calling `updateMany`, `insertOne`, etc. — the runner wraps each
  migration in a transaction when the deployment supports it.

## Deploy integration

`render.yaml` runs the migrations before the web service starts, on every
deploy. See the comments in `render.yaml` for the exact hook.

## When to use a migration vs a script

| Scenario                                                    | Use               |
|-------------------------------------------------------------|-------------------|
| Adding a new field to an existing collection, backfilling   | **migration**     |
| Changing the shape of an existing field                     | **migration**     |
| Copying data between collections once per environment       | **migration**     |
| Seeding sample products for a demo tenant                   | `scripts/seed-*`  |
| One-off dev tool to reset a tenant's password               | `scripts/*.js`    |
| Bootstrap a platform-admin user                             | `scripts/*.js`    |

Rule of thumb: **if this change should happen exactly once in every
environment (dev, staging, prod)**, it's a migration.

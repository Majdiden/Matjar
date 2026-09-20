/**
 * 013_lowercase_order_customer_emails
 *
 * The order schema now lowercases `customerSnapshot.email` and
 * `guestCustomer.email` at write time so the platform console's prefix
 * search can use the {customerSnapshot.email:1} index without a
 * case-insensitive regex. Normalise rows written before that change.
 * Idempotent: only touches rows whose stored value differs from its lowercase.
 */
export const description = "Lowercase order customerSnapshot/guestCustomer emails for indexed prefix search";

const FIELDS = ["customerSnapshot.email", "guestCustomer.email"];

export async function up(db, { logger } = {}) {
  let n = 0;
  for (const field of FIELDS) {
    const res = await db.collection("orders").updateMany(
      { $expr: { $and: [{ $eq: [{ $type: `$${field}` }, "string"] }, { $ne: [`$${field}`, { $toLower: `$${field}` }] }] } },
      [{ $set: { [field]: { $toLower: `$${field}` } } }]
    );
    n += res.modifiedCount || 0;
  }
  logger?.info?.(`013: normalised ${n} order email field(s)`);
  return { modified: n };
}

export async function down() {
  // Lossy by nature (original casing is gone); nothing to restore.
}

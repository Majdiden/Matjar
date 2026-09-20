/**
 * 010_platform_user_email_unique
 *
 * One platform account per email. Aborts loudly if duplicate
 * `{ platformAdmin: true }` rows share an email (an operator must merge them
 * by hand first), otherwise creates the partial unique index explicitly so
 * it exists before any request path relies on it. The schema also declares
 * the index (schemas/tenantUser.js) — this migration makes the rollout
 * deterministic and surfaces conflicts instead of failing on autoIndex.
 */
export const description = "Partial unique index on platform-user email (platform users Phase A)";

const INDEX_NAME = "uniq_platform_user_email";

export async function up(db, { logger } = {}) {
  const col = db.collection("tenantusers");
  const dupes = await col
    .aggregate([
      { $match: { platformAdmin: true } },
      { $group: { _id: { $toLower: "$email" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (dupes.length) {
    const list = dupes.map((d) => `${d._id} (${d.count} rows: ${d.ids.join(", ")})`).join("; ");
    throw new Error(`Cannot create ${INDEX_NAME}: duplicate platform users share an email — merge these first: ${list}`);
  }
  await col.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { platformAdmin: true }, name: INDEX_NAME }
  );
  logger?.info?.(`migrate: ${INDEX_NAME} created on tenantusers`);
}

export async function down(db, { logger } = {}) {
  try {
    await db.collection("tenantusers").dropIndex(INDEX_NAME);
    logger?.info?.(`migrate: ${INDEX_NAME} dropped`);
  } catch (err) {
    if (!/index not found/i.test(err.message)) throw err;
  }
}

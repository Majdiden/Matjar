/**
 * tenantNameMap(ids) → { [tenantId]: { name, slug } } for display in
 * cross-tenant lists (webhook inspector, feedback queue, activity feeds).
 */
import mongoose from "mongoose";

export async function tenantNameMap(ids) {
  const unique = [...new Set((ids || []).map((id) => id && String(id)).filter(Boolean))];
  if (!unique.length) return {};
  const Tenant = mongoose.model("Tenant");
  const ts = await Tenant.find({ _id: { $in: unique } }).select("name slug").lean();
  return Object.fromEntries(ts.map((t) => [String(t._id), { name: t.name, slug: t.slug }]));
}

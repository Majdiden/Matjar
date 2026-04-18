import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Theme Customization Version — append-only history of every published
 * theme state for a tenant.
 *
 * Why this exists: theme customisation lives on the tenant doc as a
 * mutable blob. Without a history table, "I just published a change and
 * the storefront looks broken — can you put it back to last week?" is
 * impossible to answer. With one row per publish, rollback is
 * deterministic: pick a version, copy its snapshot back into the draft,
 * re-publish.
 *
 * Versions are NEVER updated or deleted. The collection is the audit
 * trail; mutating it would defeat the point. Numeric `version` is
 * monotonic per tenant — the publish service computes max+1 inside the
 * same call so there's no race for a given tenant under normal load.
 */
const themeCustomizationVersionSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  version: { type: Number, required: true, min: 1 },
  themeSlug: { type: String, required: true },
  // Snapshots of the three pieces that fully describe a published state.
  // Mixed because each theme registers its own setting/section schema in
  // its manifest — locking these to a fixed shape would defeat the SDK.
  settings: {
    colors: { type: Schema.Types.Mixed, default: {} },
    typography: { type: Schema.Types.Mixed, default: {} },
    layout: { type: Schema.Types.Mixed, default: {} },
    // Manifest-level global settings snapshot. Same shape as the draft
    // and published `settings.theme` bags on the tenant doc — keeping
    // the version row faithful means rollback restores theme settings
    // alongside colors/typography/layout.
    theme: { type: Schema.Types.Mixed, default: {} },
  },
  sections: { type: [Schema.Types.Mixed], default: [] },
  // Per-template snapshot mirror of the draft's `sectionsByTemplate`.
  // Keys: index, product, collection, cart, search, page. The flat
  // `sections` array above is kept as an alias for the `index`
  // template so existing rollback consumers continue to work.
  sectionsByTemplate: { type: Schema.Types.Mixed, default: () => ({}) },
  customCSS: { type: String, default: "" },
  // Provenance: who pushed this and how it got here. `source` lets us
  // distinguish "merchant clicked publish" from "merchant rolled back to
  // version 7" so the dashboard timeline can render distinct icons.
  publishedAt: { type: Date, default: Date.now },
  publishedBy: { type: Schema.Types.ObjectId, default: null },
  source: {
    type: String,
    // Every event that can produce a new customization state lives
    // here. Kept as an append-only audit trail so the dashboard can
    // render a full timeline: "installed → published v1 → published
    // v2 → rolled back to v1 → reset → switched theme". The
    // listCustomizationVersionsService filters to user-actionable
    // rows when populating the version-picker UI.
    enum: ["publish", "rollback", "install", "uninstall", "reset", "theme_switch"],
    default: "publish",
  },
  // Optional human-readable note ("Spring sale launch", "Hotfix typo").
  label: { type: String, default: "", trim: true },
});

// Compound unique guarantees one row per (tenant, version). The publish
// service computes the next version inside a single write, so the unique
// constraint is the safety net — not the primary mechanism.
themeCustomizationVersionSchema.index(
  { tenantId: 1, version: 1 },
  { unique: true }
);
themeCustomizationVersionSchema.index({ tenantId: 1, publishedAt: -1 });

applyTenantScope(themeCustomizationVersionSchema);

export default themeCustomizationVersionSchema;

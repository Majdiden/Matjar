import { Schema } from "mongoose";

/**
 * Platform-managed theme category (admin DB). The platform owner curates
 * these from the console's Themes page; signup's "what do you sell" step and
 * the merchant theme library list the active ones in `order`.
 *
 * A theme belongs to categories through `Theme.categoryKeys` (explicit, set
 * from the console) or, while that is null, through `aliases` matched
 * against the theme manifest's free-form `categories`
 * (services/themeCategories.js → resolveThemeCategoryKeys).
 *
 * The key is stable: it is stored on tenants (`settings.niche`) and theme
 * assignments, so it cannot be renamed — only the en/ar names can.
 */
export const THEME_CATEGORY_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const themeCategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: THEME_CATEGORY_KEY_RE },
    name: {
      en: { type: String, required: true, trim: true },
      ar: { type: String, default: "", trim: true },
    },
    // Lucide icon name shown next to the category (optional).
    icon: { type: String, default: "", trim: true },
    // Manifest category strings that map onto this category for themes
    // without an explicit assignment.
    aliases: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

themeCategorySchema.index({ order: 1, key: 1 });

export default themeCategorySchema;

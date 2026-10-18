import { z } from "zod";
import { objectId } from "./platform.validator.js";
import { ANNOUNCEMENT_TITLE_MAX, ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_MAX_STORES } from "../schemas/announcement.js";

const pair = (max) =>
  z
    .object({
      ar: z.string().trim().max(max).optional().default(""),
      en: z.string().trim().max(max).optional().default(""),
    })
    .refine((p) => p.ar || p.en, { message: "Write it in Arabic, English or both" });

/** Only dashboard paths: the notification opens inside the merchant dashboard. */
const dashboardPath = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/dashboard(\/[\w\-./?=&%]*)?$/, "Use a dashboard path such as /dashboard/products");

const storeList = z.array(objectId).min(1, "Pick at least one store").max(ANNOUNCEMENT_MAX_STORES);

const audience = z.discriminatedUnion("target", [
  z.object({ target: z.literal("all") }),
  z.object({ target: z.literal("tenant"), tenantId: objectId }),
  z.object({ target: z.literal("tenants"), tenantIds: storeList }),
]);

// The reach check is a GET: picked stores travel as a comma-separated list.
export const announcementAudienceSchema = z.object({
  query: z.union([
    z.object({ target: z.literal("all") }),
    z.object({ target: z.literal("tenant"), tenantId: objectId }),
    z.object({
      target: z.literal("tenants"),
      tenantIds: z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), storeList),
    }),
  ]),
});

export const sendAnnouncementSchema = z.object({
  body: z
    .object({
      title: pair(ANNOUNCEMENT_TITLE_MAX),
      body: pair(ANNOUNCEMENT_BODY_MAX),
      link: dashboardPath.nullable().optional(),
      channels: z
        .object({ app: z.boolean(), email: z.boolean() })
        .refine((c) => c.app || c.email, { message: "Pick at least one channel" }),
    })
    .and(audience),
});

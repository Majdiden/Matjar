import { z } from "zod";
import { objectId } from "./platform.validator.js";
import { ANNOUNCEMENT_TITLE_MAX, ANNOUNCEMENT_BODY_MAX } from "../schemas/announcement.js";

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

const audience = z.discriminatedUnion("target", [
  z.object({ target: z.literal("all") }),
  z.object({ target: z.literal("tenant"), tenantId: objectId }),
]);

export const announcementAudienceSchema = z.object({
  query: z.union([
    z.object({ target: z.literal("all") }),
    z.object({ target: z.literal("tenant"), tenantId: objectId }),
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

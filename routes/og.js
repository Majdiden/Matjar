/**
 * Public Open Graph image endpoints.
 *
 * `GET /og/store-card.png` returns the dynamically composed store SHARE CARD
 * (see services/ogCard.js). Public, host-resolved to a tenant exactly like the
 * storefront (subdomain OR custom domain) via resolveTenantByHost — the same
 * resolver middlewares/storefrontServe.js uses — so no auth/JWT is involved.
 * Social crawlers hit this URL from the `<meta property="og:image">` tag.
 */

import express from "express";
import { resolveTenantByHost } from "../services/domainRegistry.js";
import { buildStoreCardPng } from "../services/ogCard.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.get("/store-card.png", async (req, res) => {
  try {
    const hostname = req.hostname || req.headers.host;
    const tenant = await resolveTenantByHost(hostname);
    if (!tenant) {
      return res.status(404).send("No store found for this host.");
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const png = await buildStoreCardPng(tenant, baseUrl);

    // Crawlers refetch rarely; a short-to-medium TTL is plenty and keeps a
    // freshly-changed logo / featured set visible within ~10 min. The service
    // also caches the composed buffer in-process keyed by a content version.
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
    res.setHeader("Content-Length", png.length);
    return res.status(200).end(png);
  } catch (error) {
    logger.error("OG store-card render failed", { error: error.message });
    return res.status(500).send("Could not render store card.");
  }
});

export default router;

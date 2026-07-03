import * as RedirectService from "../services/redirect.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Redirect controllers (audit 6.7). Dashboard-facing CRUD; the
 * storefront match/increment happens in middlewares/storefrontServe.js.
 */

export const list = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const { redirects, total, page: pageNum, limit: limitNum } =
    await RedirectService.listRedirects(req.models, { page, limit, search });
  res.json({
    success: true,
    data: {
      redirects,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const get = asyncHandler(async (req, res) => {
  const redirect = await RedirectService.getRedirect(req.models, req.params.id);
  res.json({ success: true, data: redirect });
});

export const create = asyncHandler(async (req, res) => {
  const redirect = await RedirectService.createRedirect(req.models, req.body || {});
  res.status(201).json({ success: true, data: redirect });
});

export const update = asyncHandler(async (req, res) => {
  const redirect = await RedirectService.updateRedirect(
    req.models,
    req.params.id,
    req.body || {}
  );
  res.json({ success: true, data: redirect });
});

export const remove = asyncHandler(async (req, res) => {
  await RedirectService.deleteRedirect(req.models, req.params.id);
  res.json({ success: true });
});

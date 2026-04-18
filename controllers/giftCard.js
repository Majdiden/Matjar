import * as GiftCardService from "../services/giftCard.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, status, customerId, search } = req.query;
  const result = await GiftCardService.listGiftCards(req.models, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    customerId,
    search,
  });
  res.json({ success: true, data: result });
});

export const get = asyncHandler(async (req, res) => {
  const card = await GiftCardService.getGiftCard(req.models, req.params.id);
  res.json({ success: true, data: card });
});

export const issue = asyncHandler(async (req, res) => {
  const { coverShipping, coverTax, ...rest } = req.body || {};
  const card = await GiftCardService.issueGiftCard(
    req.models,
    req.tenantId,
    { ...rest, coverShipping: !!coverShipping, coverTax: !!coverTax, issuedBy: req.user.userId }
  );
  res.status(201).json({ success: true, data: card });
});

export const adjust = asyncHandler(async (req, res) => {
  const { amount, note } = req.body || {};
  const card = await GiftCardService.adjustGiftCard(req.models, req.params.id, amount, {
    by: req.user.userId,
    note,
  });
  res.json({ success: true, data: card });
});

export const disable = asyncHandler(async (req, res) => {
  const card = await GiftCardService.disableGiftCard(req.models, req.params.id);
  res.json({ success: true, data: card });
});

export const enable = asyncHandler(async (req, res) => {
  const card = await GiftCardService.enableGiftCard(req.models, req.params.id);
  res.json({ success: true, data: card });
});

export const lookup = asyncHandler(async (req, res) => {
  const { code } = req.body || {};
  const card = await GiftCardService.lookupByCode(req.models, code);
  res.json({ success: true, data: card });
});

export const redeem = asyncHandler(async (req, res) => {
  const { code, amount, orderId } = req.body || {};
  const card = await GiftCardService.redeemGiftCard(req.models, code, amount, {
    orderId,
    by: req.user.userId,
  });
  res.json({ success: true, data: card });
});

import * as WebhookService from "../services/webhook.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

export const list = asyncHandler(async (req, res) => {
  const webhooks = await WebhookService.listWebhooks(req.models);
  res.json({ success: true, data: { webhooks } });
});

export const get = asyncHandler(async (req, res) => {
  const webhook = await WebhookService.getWebhook(req.models, req.params.id);
  res.json({ success: true, data: webhook });
});

export const create = asyncHandler(async (req, res) => {
  const webhook = await WebhookService.createWebhook(req.models, req.tenantId, req.body || {});
  res.status(201).json({ success: true, data: webhook });
});

export const update = asyncHandler(async (req, res) => {
  const webhook = await WebhookService.updateWebhook(req.models, req.params.id, req.body || {});
  res.json({ success: true, data: webhook });
});

export const remove = asyncHandler(async (req, res) => {
  await WebhookService.deleteWebhook(req.models, req.params.id);
  res.json({ success: true });
});

export const test = asyncHandler(async (req, res) => {
  const result = await WebhookService.testWebhook(req.models, req.params.id);
  res.json({ success: true, data: result });
});

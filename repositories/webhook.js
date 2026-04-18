export const listWebhooksRepo = async (models) =>
  models.Webhook.find({}).sort({ createdAt: -1 }).lean();

export const getWebhookRepo = async (models, id) =>
  models.Webhook.findById(id).lean();

export const createWebhookRepo = async (models, data) =>
  models.Webhook.create(data);

export const updateWebhookRepo = async (models, id, patch) =>
  models.Webhook.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();

export const deleteWebhookRepo = async (models, id) =>
  models.Webhook.findByIdAndDelete(id);

export const activeWebhooksForEventRepo = async (models, event) =>
  models.Webhook.find({ isActive: true, events: event }).lean();

export const recordDeliveryRepo = async (models, id, { success, status, error }) => {
  const update = {
    lastTriggered: new Date(),
    lastDelivery: { success, status, timestamp: new Date(), error },
  };
  if (success) update.failureCount = 0;
  return models.Webhook.findByIdAndUpdate(
    id,
    success
      ? { $set: update }
      : { $set: update, $inc: { failureCount: 1 } },
    { new: true }
  );
};

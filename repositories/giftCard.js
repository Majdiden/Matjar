/**
 * Gift Card Repository
 * All operations are tenant-scoped via req.models (tenantId already baked in).
 */

export const listGiftCardsRepo = async (models, { page = 1, limit = 20, status, customerId, search } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  if (search) filter.codeLast4 = search.replace(/-/g, "").slice(-4);

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    models.GiftCard.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    models.GiftCard.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

export const getGiftCardRepo = async (models, id) =>
  models.GiftCard.findById(id).lean();

export const getGiftCardByCodeHashRepo = async (models, codeHash) =>
  models.GiftCard.findOne({ codeHash }).lean();

export const createGiftCardRepo = async (models, data) =>
  models.GiftCard.create(data);

export const updateGiftCardRepo = async (models, id, patch) =>
  models.GiftCard.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();

/**
 * Atomically push a transaction, update balance, and optionally update status.
 * Uses $inc for balance delta to avoid read-modify-write races.
 *
 * @param {object} models
 * @param {string|ObjectId} id - gift card _id
 * @param {object} tx - transaction object matching transactionSchema
 * @param {number} balanceDelta - amount to add to balance (negative to subtract)
 * @param {string|null} newStatus - if provided, set status
 * @param {object} conditions - extra query conditions (e.g. balance minimum check)
 */
export const addTransactionRepo = async (models, id, tx, balanceDelta, newStatus, conditions = {}) => {
  const query = { _id: id, ...conditions };
  const update = {
    $inc: { balance: balanceDelta },
    $push: { transactions: tx },
  };
  if (newStatus) update.$set = { status: newStatus };

  const doc = await models.GiftCard.findOneAndUpdate(query, update, { new: true }).lean();
  return doc; // null if conditions not met (balance check failed, doc not found, etc.)
};

/**
 * Atomic redeem using aggregation pipeline update so the new status is derived
 * from the post-decrement balance in a single op (no stale read).
 */
export const redeemCardAtomicRepo = async (models, id, tx, amount) => {
  const query = { _id: id, status: "active", balance: { $gte: amount } };
  const pipeline = [
    {
      $set: {
        balance: { $subtract: ["$balance", amount] },
      },
    },
    {
      $set: {
        status: {
          $cond: [{ $lte: ["$balance", 0] }, "redeemed", "active"],
        },
        transactions: {
          $concatArrays: [
            "$transactions",
            [{ ...tx, balanceAfter: "$balance" }],
          ],
        },
      },
    },
  ];
  return models.GiftCard.findOneAndUpdate(query, pipeline, { new: true }).lean();
};

export const bulkExpireCardsRepo = async (models, now = new Date()) =>
  models.GiftCard.updateMany(
    { status: "active", expiresAt: { $ne: null, $lt: now } },
    { $set: { status: "expired" } }
  );

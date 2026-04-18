import mongoose from "mongoose";

/**
 * Cursor = base64 JSON({ createdAt, id }). Tie-break on _id so pages are
 * stable when multiple notifications share the same millisecond.
 */
const encodeCursor = (doc) => {
  const payload = JSON.stringify({
    createdAt: new Date(doc.createdAt).toISOString(),
    id: String(doc._id),
  });
  return Buffer.from(payload, "utf8").toString("base64");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt || !parsed?.id) return null;
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
};

/**
 * Build the visibility filter a given user sees: permission gate + recipient
 * whitelist + not-dismissed.
 */
const buildVisibilityFilter = (userId, permissions) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const hasStar = permissions instanceof Set ? permissions.has("*") : false;

  const perms = permissions instanceof Set ? Array.from(permissions) : [];

  // Permission gate
  const permissionClause = hasStar
    ? {}
    : {
        $or: [
          { permission: null },
          { permission: { $exists: false } },
          { permission: { $in: perms } },
        ],
      };

  // Recipient gate — empty array means broadcast; otherwise must include user.
  const recipientClause = {
    $or: [
      { recipientUserIds: { $exists: false } },
      { recipientUserIds: { $size: 0 } },
      { recipientUserIds: uid },
    ],
  };

  // Not dismissed by this user
  const dismissedClause = { dismissedBy: { $ne: uid } };

  const clauses = [recipientClause, dismissedClause];
  if (!hasStar) clauses.push(permissionClause);
  return { $and: clauses };
};

export const createNotification = async (models, payload) => {
  const doc = await models.Notification.create(payload);
  // `create` from the scoped model returns a Mongoose doc; lean it for the
  // consumer so downstream serialization (JSON.stringify in SSE) is cheap.
  return doc.toObject ? doc.toObject() : doc;
};

export const listNotifications = async (
  models,
  { userId, permissions, cursor, limit = 20, unreadOnly = false, types } = {}
) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const baseFilter = buildVisibilityFilter(userId, permissions);

  const extra = [];
  if (unreadOnly) {
    extra.push({ "readBy.userId": { $ne: uid } });
  }
  if (Array.isArray(types) && types.length > 0) {
    extra.push({ type: { $in: types } });
  }

  const decoded = decodeCursor(cursor);
  if (decoded) {
    extra.push({
      $or: [
        { createdAt: { $lt: decoded.createdAt } },
        {
          createdAt: decoded.createdAt,
          _id: { $lt: new mongoose.Types.ObjectId(decoded.id) },
        },
      ],
    });
  }

  const filter = extra.length
    ? { $and: [baseFilter, ...extra] }
    : baseFilter;

  const pageSize = Math.max(1, Math.min(100, Number(limit) || 20));

  const rows = await models.Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

  return { items, nextCursor, hasMore };
};

export const markRead = async (models, id, userId, permissions) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const baseFilter = buildVisibilityFilter(userId, permissions);
  // Idempotent: $addToSet + guard on the nested userId so we don't append a
  // second readAt if the user clicks twice. Also enforce visibility so a
  // user can't mutate notifications they aren't allowed to see.
  const result = await models.Notification.updateOne(
    {
      $and: [
        baseFilter,
        { _id: id },
        { "readBy.userId": { $ne: uid } },
      ],
    },
    { $addToSet: { readBy: { userId: uid, readAt: new Date() } } }
  );
  return result;
};

export const markAllRead = async (models, userId, permissions, before = null) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const baseFilter = buildVisibilityFilter(userId, permissions);
  const extra = [{ "readBy.userId": { $ne: uid } }];
  if (before) extra.push({ createdAt: { $lte: new Date(before) } });
  const filter = { $and: [baseFilter, ...extra] };

  const result = await models.Notification.updateMany(filter, {
    $addToSet: { readBy: { userId: uid, readAt: new Date() } },
  });
  return result;
};

export const dismiss = async (models, id, userId, permissions) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const baseFilter = buildVisibilityFilter(userId, permissions);
  return await models.Notification.updateOne(
    { $and: [baseFilter, { _id: id }] },
    { $addToSet: { dismissedBy: uid } }
  );
};

export const countUnread = async (models, userId, permissions) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const baseFilter = buildVisibilityFilter(userId, permissions);
  const filter = {
    $and: [baseFilter, { "readBy.userId": { $ne: uid } }],
  };
  return await models.Notification.countDocuments(filter);
};

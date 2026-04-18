export const listMenusRepo = async (models) =>
  models.Menu.find({}).sort({ createdAt: -1 }).lean();

export const getMenuRepo = async (models, id) =>
  models.Menu.findById(id).lean();

export const getMenuByHandleRepo = async (models, handle) =>
  models.Menu.findOne({ handle: handle.toLowerCase().trim() }).lean();

export const getMenuByLocationRepo = async (models, location) =>
  models.Menu.findOne({ location, isActive: true }).sort({ updatedAt: -1 }).lean();

export const createMenuRepo = async (models, data) =>
  models.Menu.create(data);

export const updateMenuRepo = async (models, id, patch) =>
  models.Menu.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();

export const deleteMenuRepo = async (models, id) =>
  models.Menu.findByIdAndDelete(id);

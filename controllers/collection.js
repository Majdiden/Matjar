import * as CollectionService from "../services/collection.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  getPreviewThemeSlug,
  demoCollectionsList,
  demoCollectionByHandle,
} from "../services/themeDemoPreview.js";

// ─── Admin controllers ────────────────────────────────────────────────────────

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, published } = req.query;
  const { collections, total } = await CollectionService.listCollections(req.models, {
    page,
    limit,
    search,
    published,
  });
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  res.json({
    success: true,
    data: {
      collections,
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
  const collection = await CollectionService.getCollection(req.models, req.params.id);
  res.json({ success: true, data: collection });
});

export const create = asyncHandler(async (req, res) => {
  const collection = await CollectionService.createCollection(req.models, req.tenantId, req.body || {});
  res.status(201).json({ success: true, data: collection });
});

export const update = asyncHandler(async (req, res) => {
  const collection = await CollectionService.updateCollection(req.models, req.params.id, req.body || {});
  res.json({ success: true, data: collection });
});

export const remove = asyncHandler(async (req, res) => {
  await CollectionService.deleteCollection(req.models, req.params.id);
  res.json({ success: true });
});

export const addProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body || {};
  const collection = await CollectionService.addProducts(req.models, req.params.id, productIds);
  res.json({ success: true, data: collection });
});

export const removeProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body || {};
  const collection = await CollectionService.removeProducts(req.models, req.params.id, productIds);
  res.json({ success: true, data: collection });
});

export const reorderProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body || {};
  const collection = await CollectionService.reorderProducts(req.models, req.params.id, productIds);
  res.json({ success: true, data: collection });
});

export const preview = asyncHandler(async (req, res) => {
  const collection = await CollectionService.getCollection(req.models, req.params.id);
  const { page = 1, limit = 24 } = req.query;
  const result = await CollectionService.resolveProducts(req.models, collection, { page, limit });
  res.json({ success: true, data: result });
});

// ─── Storefront controllers ───────────────────────────────────────────────────

export const storefrontListCollections = asyncHandler(async (req, res) => {
  // Theme PREVIEW — ephemeral demo collections from memory, never the DB.
  const demoSlug = getPreviewThemeSlug(req);
  if (demoSlug) {
    return res.json({ success: true, data: demoCollectionsList(demoSlug, req.query) });
  }

  const { page = 1, limit = 20, search } = req.query;
  const { collections, total } = await CollectionService.listCollections(req.models, {
    page,
    limit,
    search,
    published: "true",
  });
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  res.json({
    success: true,
    data: {
      collections,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const storefrontGetCollectionByHandle = asyncHandler(async (req, res) => {
  const demoSlug = getPreviewThemeSlug(req);
  if (demoSlug) {
    const payload = demoCollectionByHandle(demoSlug, req.params.handle, req.query);
    if (!payload) {
      return res.status(404).json({ success: false, message: "Collection not found" });
    }
    return res.json({ success: true, data: payload });
  }

  const collection = await CollectionService.getCollectionByHandle(req.models, req.params.handle);
  if (!collection.isPublished) {
    return res.status(404).json({ success: false, message: "Collection not found" });
  }
  const { page = 1, limit = 24 } = req.query;
  const result = await CollectionService.resolveProducts(req.models, collection, { page, limit });
  res.json({ success: true, data: { collection, ...result } });
});

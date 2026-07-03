/**
 * Redirect Service (audit 6.7)
 *
 * Validation + CRUD business rules for merchant-defined URL redirects.
 * The storefront match/increment hot path lives in
 * middlewares/storefrontServe.js (it runs on public requests without a
 * scoped `models` bag); this layer is the dashboard-facing CRUD.
 */
import {
  listRedirectsRepo,
  getRedirectRepo,
  findRedirectByFromPathRepo,
  createRedirectRepo,
  updateRedirectRepo,
  deleteRedirectRepo,
} from "../repositories/redirect.js";
import { APIError } from "../middlewares/errorHandler.js";

/**
 * Normalise + validate a source path. Must be a root-relative path
 * starting with "/", never the bare "/" (that would 3xx the entire
 * storefront), and free of a query string / fragment (exact-match is on
 * the pathname only). Returns the normalised value or throws 400.
 */
export function normaliseFromPath(input) {
  if (typeof input !== "string") throw new APIError("fromPath must be a string", 400);
  let p = input.trim();
  if (!p) throw new APIError("fromPath is required", 400);
  if (!p.startsWith("/")) throw new APIError("fromPath must start with '/'", 400);
  // Drop a trailing query/hash — matching is on the pathname.
  p = p.split("#")[0].split("?")[0];
  // Collapse a trailing slash (except the root) so "/about/" and
  // "/about" don't create two competing rules.
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  if (p === "/") throw new APIError("fromPath cannot be the storefront root '/'", 400);
  if (p.length > 1024) throw new APIError("fromPath is too long", 400);
  return p;
}

/**
 * Validate a destination. Accepts a root-relative path ("/pages/x") or
 * an absolute http(s) URL. Rejects everything else (no javascript:,
 * protocol-relative, etc.).
 */
export function normaliseToPath(input) {
  if (typeof input !== "string") throw new APIError("toPath must be a string", 400);
  const p = input.trim();
  if (!p) throw new APIError("toPath is required", 400);
  if (p.length > 2048) throw new APIError("toPath is too long", 400);
  if (p.startsWith("/")) {
    if (p.startsWith("//")) throw new APIError("toPath cannot be protocol-relative", 400);
    return p;
  }
  if (/^https?:\/\//i.test(p)) return p;
  throw new APIError("toPath must be a relative path ('/...') or an http(s) URL", 400);
}

function normaliseStatusCode(input) {
  if (input == null) return 301;
  const n = Number(input);
  if (n !== 301 && n !== 302) throw new APIError("statusCode must be 301 or 302", 400);
  return n;
}

async function assertFromPathUnique(models, fromPath, excludeId = null) {
  const existing = await findRedirectByFromPathRepo(models, fromPath);
  if (existing && (!excludeId || String(existing._id) !== String(excludeId))) {
    throw new APIError(`A redirect from "${fromPath}" already exists`, 409);
  }
}

export const listRedirects = async (models, query = {}) =>
  listRedirectsRepo(models, query);

export const getRedirect = async (models, id) => {
  const redirect = await getRedirectRepo(models, id);
  if (!redirect) throw new APIError("Redirect not found", 404);
  return redirect;
};

export const createRedirect = async (models, data = {}) => {
  const fromPath = normaliseFromPath(data.fromPath);
  const toPath = normaliseToPath(data.toPath);
  const statusCode = normaliseStatusCode(data.statusCode);
  if (fromPath === toPath) {
    throw new APIError("fromPath and toPath must differ", 400);
  }
  await assertFromPathUnique(models, fromPath);
  const now = new Date();
  const doc = await createRedirectRepo(models, {
    fromPath,
    toPath,
    statusCode,
    hits: 0,
    createdAt: now,
    updatedAt: now,
  });
  return doc.toObject ? doc.toObject() : doc;
};

export const updateRedirect = async (models, id, patch = {}) => {
  const existing = await getRedirectRepo(models, id);
  if (!existing) throw new APIError("Redirect not found", 404);

  const allowed = {};
  if (patch.fromPath !== undefined) {
    allowed.fromPath = normaliseFromPath(patch.fromPath);
  }
  if (patch.toPath !== undefined) {
    allowed.toPath = normaliseToPath(patch.toPath);
  }
  if (patch.statusCode !== undefined) {
    allowed.statusCode = normaliseStatusCode(patch.statusCode);
  }

  const nextFrom = allowed.fromPath ?? existing.fromPath;
  const nextTo = allowed.toPath ?? existing.toPath;
  if (nextFrom === nextTo) {
    throw new APIError("fromPath and toPath must differ", 400);
  }
  if (allowed.fromPath && allowed.fromPath !== existing.fromPath) {
    await assertFromPathUnique(models, allowed.fromPath, id);
  }

  const updated = await updateRedirectRepo(models, id, allowed);
  if (!updated) throw new APIError("Redirect not found", 404);
  return updated;
};

export const deleteRedirect = async (models, id) => {
  const row = await deleteRedirectRepo(models, id);
  if (!row) throw new APIError("Redirect not found", 404);
  return { id };
};

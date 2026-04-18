/**
 * Test Express app helper — builds a minimal app that mounts the real
 * route config so supertest can hit the same handlers production runs.
 *
 * Why a separate factory instead of importing index.js? `index.js` boots
 * Redis, sessions, helmet, rate limiters, the storefront SPA serving
 * middleware and a real `app.listen()` — none of which we want under test.
 * The contract here is intentionally narrow: parse JSON, run the route
 * config, and surface errors. Tests then drive the *routes*, not the
 * production wiring around them.
 */
import express from "express";
import RouteConfig from "../../server/route.config.js";
import { errorHandler, notFoundHandler } from "../../middlewares/errorHandler.js";

export function buildTestApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Stub `req.session` so handlers that touch it (e.g. the storefront cart
  // controller's `req.session.cartSessionId` for guest carts) don't crash
  // here. Production wires up express-session with redis, but tests don't
  // need real session persistence — an in-memory bag per request is enough
  // because every test drives requests with bearer tokens (authenticated),
  // making the guest-session branch unreachable.
  app.use((req, _res, next) => {
    req.session = req.session || {};
    next();
  });

  // RouteConfig mounts /api, /storefront, /dashboard and the storefront
  // catch-all. Tenant resolution happens via the Host header — tests set
  // `Host: <slug>.localhost` to drive the resolver to a specific tenant.
  RouteConfig(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

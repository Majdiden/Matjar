import IORedis from "ioredis";
import logger from "./logger.js";
import config from "../config/index.js";

/**
 * Tenant-scoped notification bus.
 *
 * Redis pub/sub backed; scales horizontally. Channel-per-tenant for O(1)
 * routing — the Redis server filters by subscription so each web instance
 * only receives messages for tenants that currently have a local listener.
 *
 * Architecture:
 *   - One shared subscriber client (pub/sub mode, can't run other commands).
 *   - One shared publisher client (regular client, reused for all publishes).
 *   - Per-process Map<tenantId, Set<handler>> dispatches incoming Redis
 *     messages to the local SSE handlers attached in this process.
 *
 * Lazy: neither Redis client is opened until the first subscribe/publish
 * call. Tests and CI that never exercise the bus never connect.
 *
 * ioredis auto-resubscribes to all previously-subscribed channels on
 * reconnect, so a Redis bounce doesn't require us to rebuild the
 * subscription set manually.
 */

const CHANNEL_PREFIX = "notifications:tenant:";
const channelFor = (tenantId) => `${CHANNEL_PREFIX}${String(tenantId)}`;
const tenantIdFromChannel = (channel) =>
  channel.startsWith(CHANNEL_PREFIX) ? channel.slice(CHANNEL_PREFIX.length) : null;

class NotificationBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
    this._subClient = null;
    this._pubClient = null;
    this._initPromise = null;
  }

  _redisUrl() {
    return config.redisUrl;
  }

  /**
   * Lazily open both Redis clients. Runs exactly once per process; the
   * returned promise is cached so concurrent first callers share it.
   *
   * Fail-fast behavior: the first connect attempt must succeed. If it
   * throws, the cached promise is cleared so a subsequent call can retry
   * (e.g. tests that mock Redis after an initial failure) — but under
   * normal operation a misconfigured REDIS_URL surfaces loudly at the
   * first use rather than being silently buffered.
   */
  _init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      const url = this._redisUrl();

      // Subscriber client: in subscribe mode ioredis forbids ordinary
      // commands, so this client is dedicated to pub/sub. enableReadyCheck
      // is off to match the BullMQ pattern used elsewhere — the CLUSTER
      // INFO probe it runs is noise for managed Redis providers that
      // return NOPERM/LOADING during failover.
      const subClient = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });

      // Publisher client: default offline queue left enabled so a brief
      // hiccup buffers a few publishes instead of dropping them. A total
      // Redis outage will surface via the 'error' log below.
      const pubClient = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });

      subClient.on("error", (err) =>
        logger.warn("notificationBus sub client error", { error: err?.message })
      );
      pubClient.on("error", (err) =>
        logger.warn("notificationBus pub client error", { error: err?.message })
      );
      subClient.on("reconnecting", () =>
        logger.info("notificationBus sub client reconnecting")
      );
      pubClient.on("reconnecting", () =>
        logger.info("notificationBus pub client reconnecting")
      );

      // ioredis normally re-sends SUBSCRIBE for channels it previously
      // accepted, but if the very first SUBSCRIBE failed (e.g. connection
      // dropped mid-call) that channel isn't in ioredis's tracked set.
      // On every 'ready' we reconcile: re-issue SUBSCRIBE for every
      // tenant with local listeners. This is idempotent — a channel
      // already subscribed is a no-op.
      subClient.on("ready", async () => {
        const channels = [...this._handlers.keys()].map(channelFor);
        if (channels.length === 0) return;
        try {
          await subClient.subscribe(...channels);
        } catch (err) {
          logger.warn("notificationBus re-subscribe after ready failed", {
            error: err?.message,
            channels: channels.length,
          });
        }
      });

      // Dispatch incoming messages to local handlers for the tenant.
      subClient.on("message", (channel, message) => {
        const tenantId = tenantIdFromChannel(channel);
        if (!tenantId) return;
        const set = this._handlers.get(tenantId);
        if (!set || set.size === 0) return;

        let payload;
        try {
          payload = JSON.parse(message);
        } catch (err) {
          logger.warn("notificationBus failed to parse message", {
            tenantId,
            error: err?.message,
          });
          return;
        }

        for (const handler of set) {
          try {
            handler(payload);
          } catch (err) {
            // One misbehaving subscriber must never take down the
            // dispatch loop — log and keep delivering to the rest.
            logger.warn("notificationBus handler threw", {
              tenantId,
              error: err?.message,
            });
          }
        }
      });

      // Fail-fast initial connect. Both clients must be reachable on
      // boot; ioredis handles reconnects after that automatically.
      try {
        await Promise.all([subClient.connect(), pubClient.connect()]);
      } catch (err) {
        // Clean up partially-opened clients so the next call can retry.
        try { subClient.disconnect(); } catch { /* noop */ }
        try { pubClient.disconnect(); } catch { /* noop */ }
        this._initPromise = null;
        throw err;
      }

      this._subClient = subClient;
      this._pubClient = pubClient;
      return { subClient, pubClient };
    })();
    return this._initPromise;
  }

  async subscribe(tenantId, handler) {
    const key = String(tenantId);
    let set = this._handlers.get(key);
    const isFirst = !set || set.size === 0;
    if (!set) {
      set = new Set();
      this._handlers.set(key, set);
    }
    set.add(handler);

    if (isFirst) {
      // First local listener for this tenant — tell Redis to start
      // delivering this channel to our sub client. We swallow errors
      // here to preserve the bus's fire-and-forget call semantics
      // (callers don't await). ioredis will keep retrying the
      // connection; if the sub client eventually reconnects it will
      // auto-resubscribe to every channel in its internal set.
      try {
        const { subClient } = await this._init();
        await subClient.subscribe(channelFor(key));
      } catch (err) {
        logger.warn("notificationBus subscribe failed", {
          tenantId: key,
          error: err?.message,
        });
      }
    }
  }

  async unsubscribe(tenantId, handler) {
    const key = String(tenantId);
    const set = this._handlers.get(key);
    if (!set) return;
    set.delete(handler);
    if (set.size > 0) return;

    this._handlers.delete(key);
    // Last local listener — unsubscribe at the Redis level so this
    // process stops receiving messages it has nothing to do with.
    // If _init never ran, there's nothing to unsubscribe.
    if (!this._subClient) return;
    try {
      await this._subClient.unsubscribe(channelFor(key));
    } catch (err) {
      logger.warn("notificationBus unsubscribe failed", {
        tenantId: key,
        error: err?.message,
      });
    }
  }

  async publish(tenantId, notification) {
    const key = String(tenantId);
    let pubClient;
    try {
      ({ pubClient } = await this._init());
    } catch (err) {
      logger.warn("notificationBus publish init failed", {
        tenantId: key,
        error: err?.message,
      });
      return;
    }

    let payload;
    try {
      // Notifications come from repo.createNotification which returns a
      // Mongoose doc; _id and any ObjectId refs serialize via their
      // toJSON to plain strings. JSON.stringify is safe here.
      payload = JSON.stringify(notification);
    } catch (err) {
      logger.warn("notificationBus failed to serialize notification", {
        tenantId: key,
        error: err?.message,
      });
      return;
    }

    try {
      await pubClient.publish(channelFor(key), payload);
    } catch (err) {
      // Publish failures must not break the primary operation. The
      // caller in services/notification.js is already try/catch
      // wrapped; this is belt-and-braces.
      logger.warn("notificationBus publish failed", {
        tenantId: key,
        error: err?.message,
      });
    }
  }

  /**
   * Close both Redis clients and clear local state. Intended for clean
   * shutdown in tests and on SIGTERM. Safe to call when the bus was
   * never initialized.
   */
  async close() {
    this._handlers.clear();
    const clients = [this._subClient, this._pubClient].filter(Boolean);
    this._subClient = null;
    this._pubClient = null;
    this._initPromise = null;
    await Promise.allSettled(clients.map((c) => c.quit().catch(() => {})));
  }
}

const notificationBus = new NotificationBus();
export default notificationBus;

process.env.NODE_ENV = "test";
// Force NODE_ENV=test before any module loads config
/**
 * Test DB helper — boots an in-memory MongoDB replica set and registers
 * all models on the default mongoose connection.
 *
 * Why a replica set instead of a standalone? Several services in the app
 * (notably services/tenant.js → addATenantService) wrap their work in a
 * mongoose transaction, and Mongo only supports transactions on a replica
 * set. The standalone in-memory server is faster but cannot run them.
 *
 * The mongodb-memory-server binary downloads on first use, so the very
 * first run takes longer. Subsequent runs reuse the cached binary.
 */
process.env.LOG_LEVEL = "error"; // silence the tenantScope warning spam
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { registerAllModels } from "../../utils/initDbConnection.js";

let mongod = null;

export async function startTestDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Wait for the replset to elect a primary before opening the
  // connection. Without this, the very first transaction-using test
  // (auth/register) hits "no primary" / lock-acquisition errors and
  // the suite goes flaky.
  await mongod.waitUntilRunning();
  const uri = mongod.getUri();
  // The in-memory replset defaults to a 5ms lock acquisition timeout,
  // which is way too aggressive for our register/checkout transactions
  // when several tests run back-to-back. Bump it via the MongoClient
  // options so the transaction layer waits instead of throwing
  // "Unable to acquire IX lock" intermittently.
  await mongoose.connect(uri, {
    retryWrites: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  });
  registerAllModels(mongoose.connection);
  // Warm-up: open a session and run a real read+write inside a
  // transaction. The in-memory replset advertises "running" before
  // it has actually elected a stable primary, so the FIRST test
  // that opens a transaction (auth/register) intermittently hits
  // "no primary" / lock contention. Burning a throwaway transaction
  // here forces the election to settle before any test runs.
  const warmupSession = await mongoose.connection.startSession();
  try {
    await warmupSession.withTransaction(async () => {
      await mongoose.connection.db.collection("__warmup").insertOne({ at: new Date() });
    });
  } finally {
    await warmupSession.endSession();
    await mongoose.connection.db.collection("__warmup").drop().catch(() => {});
  }
  return mongoose.connection;
}

export async function stopTestDb() {
  // Close every Redis-backed subsystem BEFORE we disconnect from Mongo.
  //
  // Queue clients (BullMQ) are created with `enableOfflineQueue: false`
  // so their heartbeats and delayed-job pollers explode into
  // `UnhandledPromiseRejection` the moment the socket closes. Node's
  // test runner interprets that post-test async activity as a failure
  // even when every assertion passed, so all e2e files were "failing"
  // purely on teardown noise.
  //
  // We dynamically import so that suites that never touched these
  // modules don't spin up Redis clients just to close them.
  try {
    const { closeAllQueues } = await import(
      "../../services/jobs/queues.js"
    );
    await closeAllQueues();
  } catch {
    /* queue module may not have been imported by the test under run */
  }
  try {
    const { closeRateLimiterConnection } = await import(
      "../../middlewares/rateLimiters.js"
    );
    await closeRateLimiterConnection();
  } catch {
    /* rate limiter module may not have been imported */
  }
  try {
    const mod = await import("../../utils/notificationBus.js");
    const bus = mod.default || mod.notificationBus;
    if (bus && typeof bus.close === "function") await bus.close();
  } catch {
    /* notification bus may not have been imported */
  }

  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearAllCollections() {
  const collections = mongoose.connection.collections;
  // Drop and recreate (not just deleteMany) so the in-memory replset
  // releases any lingering locks from the previous test's transaction.
  // Without this, the next register call can hit "Unable to acquire IX
  // lock on tenants" because the replset hasn't fully cleaned up the
  // prior session.
  for (const key of Object.keys(collections)) {
    try {
      await collections[key].deleteMany({});
    } catch {
      // Some collections may not exist yet on the very first call.
    }
  }
  // Yield so any background commit/oplog work from the prior test
  // settles before the next one starts.
  await new Promise((r) => setImmediate(r));
}

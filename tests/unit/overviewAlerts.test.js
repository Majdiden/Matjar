/**
 * Overview alert derivation — pure function, no DB.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveAlerts } from "../../services/platform/overview.js";

describe("deriveAlerts", () => {
  it("returns no alerts when every counter is zero", () => {
    assert.deepEqual(deriveAlerts({ operations: {}, revenue: {}, platform: {} }), []);
  });

  it("orders alerts critical → warning → info and carries counts + links", () => {
    const alerts = deriveAlerts({
      operations: {
        failedJobs: 3,
        failedJobsByQueue: [{ queue: "email", failed: 0 }, { queue: "webhook-delivery", failed: 3 }],
        stuckSetups: 1,
        queueBacklog: 12,
        failedWebhooks: 0,
        domainProblems: 0,
        queuesUnavailable: 0,
        failedSetups: 0,
      },
      revenue: { overdueStatements: 2 },
      platform: { suspended: 4 },
    });
    assert.deepEqual(alerts.map((a) => a.severity), ["critical", "warning", "warning", "info", "info"]);
    const jobs = alerts.find((a) => a.title.includes("Failed background jobs"));
    assert.equal(jobs.count, 3);
    assert.equal(jobs.href, "/queues?queue=webhook-delivery");
    assert.equal(alerts.find((a) => a.title.includes("Overdue")).href, "/billing?status=overdue");
    assert.equal(alerts.find((a) => a.title.includes("Suspended")).count, 4);
  });

  it("flags unavailable queues as critical", () => {
    const alerts = deriveAlerts({ operations: { queuesUnavailable: 9 } });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].severity, "critical");
  });
});

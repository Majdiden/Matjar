/**
 * Pure analytics helpers — bucketing, alignment, cohorts, histograms.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bucketKey,
  bucketKeys,
  alignSeries,
  addMonths,
  cohortRetention,
  histogram,
} from "../../services/platform/analyticsSeries.js";

describe("bucketing", () => {
  it("keys by UTC day / ISO-week Monday / month", () => {
    const d = new Date("2026-09-20T23:30:00Z"); // Sunday
    assert.equal(bucketKey(d, "day"), "2026-09-20");
    assert.equal(bucketKey(d, "week"), "2026-09-14"); // Monday of that week
    assert.equal(bucketKey(d, "month"), "2026-09");
  });

  it("enumerates every bucket in the range inclusive", () => {
    assert.deepEqual(bucketKeys(new Date("2026-01-30Z"), new Date("2026-02-02Z"), "day"), [
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
    assert.deepEqual(bucketKeys(new Date("2025-11-15Z"), new Date("2026-02-01Z"), "month"), [
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    // Week buckets start on Monday; a range inside one week is one bucket.
    assert.deepEqual(bucketKeys(new Date("2026-09-15Z"), new Date("2026-09-18Z"), "week"), ["2026-09-14"]);
  });

  it("aligns sparse rows and zero-fills gaps", () => {
    const keys = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const rows = [{ key: "2026-09-02", n: 5, gmv: 12.5 }];
    assert.deepEqual(alignSeries(keys, rows, ["n", "gmv"]), [
      { key: "2026-09-01", n: 0, gmv: 0 },
      { key: "2026-09-02", n: 5, gmv: 12.5 },
      { key: "2026-09-03", n: 0, gmv: 0 },
    ]);
  });
});

describe("cohorts", () => {
  it("adds months across year boundaries", () => {
    assert.equal(addMonths("2025-11", 3), "2026-02");
    assert.equal(addMonths("2026-01", 0), "2026-01");
  });

  it("computes retention per horizon and marks unelapsed horizons null", () => {
    const now = new Date("2026-09-15Z");
    const stores = [
      // June cohort: 3 stores, 2 activated, one closed in July.
      { createdMonth: "2026-06", activeUntil: null, everActive: true },
      { createdMonth: "2026-06", activeUntil: new Date("2026-07-10Z"), everActive: true },
      { createdMonth: "2026-06", activeUntil: null, everActive: false },
      // August cohort: horizons +2/+3 not elapsed yet.
      { createdMonth: "2026-08", activeUntil: null, everActive: true },
    ];
    const rows = cohortRetention(stores, { now });
    assert.equal(rows.length, 2);
    const june = rows.find((r) => r.cohort === "2026-06");
    assert.equal(june.size, 3);
    assert.equal(june.activated, 2);
    // Retained at +k = still active at the START of month cohort+k. The store
    // that closed on Jul 10 was still active on Jul 1 (+1) but not Aug 1 (+2).
    assert.deepEqual(june.retained, [2, 1, 1]);
    assert.deepEqual(june.retainedPct, [100, 50, 50]);
    const aug = rows.find((r) => r.cohort === "2026-08");
    assert.deepEqual(aug.retained, [1, null, null]);
    assert.deepEqual(aug.retainedPct, [100, null, null]);
  });

  it("keeps only the newest maxCohorts", () => {
    const stores = ["2025-01", "2025-02", "2025-03"].map((m) => ({ createdMonth: m, activeUntil: null, everActive: true }));
    const rows = cohortRetention(stores, { now: new Date("2026-01-01Z"), maxCohorts: 2 });
    assert.deepEqual(rows.map((r) => r.cohort), ["2025-02", "2025-03"]);
  });
});

describe("histogram", () => {
  it("buckets values with an open-ended last bucket", () => {
    const h = histogram([0, 3, 10, 55, 120], [0, 10, 50, 100]);
    assert.deepEqual(h.map((b) => [b.label, b.count]), [
      ["0–9", 2],
      ["10–49", 1],
      ["50–99", 1],
      ["100+", 1],
    ]);
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  billingCycleRange,
  effectiveTrafficQueryStart,
  trafficValue,
} from "../src/theme-server-status/trafficCycle.ts";

test("billing cycle starts on this month's reset day after reset", () => {
  const range = billingCycleRange(10, new Date(2026, 8, 13, 12));
  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth(), range.start.getDate()],
    [2026, 8, 10],
  );
  assert.deepEqual(
    [range.nextReset.getFullYear(), range.nextReset.getMonth(), range.nextReset.getDate()],
    [2026, 9, 10],
  );
});

test("billing cycle uses previous month before reset", () => {
  const range = billingCycleRange(25, new Date(2026, 8, 13, 12));
  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth(), range.start.getDate()],
    [2026, 7, 25],
  );
  assert.deepEqual(
    [range.nextReset.getFullYear(), range.nextReset.getMonth(), range.nextReset.getDate()],
    [2026, 8, 25],
  );
});

test("day 31 clamps to the last day in short months", () => {
  const range = billingCycleRange(31, new Date(2027, 1, 28, 12));
  assert.equal(range.start.getDate(), 28);
  assert.equal(range.nextReset.getDate(), 31);
});

test("traffic quota modes use the provider-selected direction", () => {
  assert.equal(trafficValue("sum", 40, 60), 100);
  assert.equal(trafficValue("max", 40, 60), 60);
  assert.equal(trafficValue("min", 40, 60), 40);
  assert.equal(trafficValue("up", 40, 60), 40);
  assert.equal(trafficValue("down", 40, 60), 60);
});

test("partial first cycle queries from history start", () => {
  const cycleStart = new Date(2026, 7, 25);
  assert.equal(
    effectiveTrafficQueryStart(cycleStart, "2026-09-13").getTime(),
    new Date(2026, 8, 13).getTime(),
  );
  assert.equal(
    effectiveTrafficQueryStart(new Date(2026, 8, 25), "2026-09-13").getTime(),
    new Date(2026, 8, 25).getTime(),
  );
});

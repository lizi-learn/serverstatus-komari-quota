import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMbps,
  formatDateOnly,
  daysUntil,
  isFleetVisible,
  parseNodeMetadata,
} from "../src/theme-server-status/nodeMetadata.ts";

test("parses structured node metadata without depending on tag order", () => {
  assert.deepEqual(
    parseNodeMetadata("vpn; lifecycle=keep ; bw-up=100 ;role=dmca-resistant; bw-down=100;traffic-reset-day=12;traffic-reset-source=inferred;traffic-history-since=2026-09-13"),
    {
      bandwidthDownMbps: 100,
      bandwidthUpMbps: 100,
      lifecycle: "keep",
      role: "dmca-resistant",
      trafficResetDay: 12,
      trafficResetSource: "inferred",
      trafficHistorySince: "2026-09-13",
    },
  );
});

test("ignores invalid bandwidth and lifecycle values", () => {
  assert.deepEqual(
    parseNodeMetadata("bw-down=0;bw-up=-5;lifecycle=forever;plain-tag"),
    {},
  );
});

test("formats exact advertised Mbps values compactly", () => {
  assert.equal(formatMbps(undefined), "-");
  assert.equal(formatMbps(100), "100M");
  assert.equal(formatMbps(1000), "1G");
  assert.equal(formatMbps(1040), "1040M");
});

test("fleet theme always excludes Komari hidden nodes", () => {
  assert.equal(isFleetVisible(false), true);
  assert.equal(isFleetVisible(undefined), true);
  assert.equal(isFleetVisible(true), false);
});

test("rejects impossible reset days", () => {
  assert.deepEqual(
    parseNodeMetadata("traffic-reset-day=0;traffic-reset-source=guess"),
    {},
  );
  assert.deepEqual(parseNodeMetadata("traffic-reset-day=31"), {
    trafficResetDay: 31,
  });
});

test("rejects malformed traffic history dates", () => {
  assert.deepEqual(parseNodeMetadata("traffic-history-since=2026/09/13"), {});
  assert.deepEqual(parseNodeMetadata("traffic-history-since=not-a-date"), {});
});

test("formats expiry dates and remaining days deterministically", () => {
  assert.equal(formatDateOnly("2027-08-12T00:00:00+08:00"), "2027-08-12");
  assert.equal(
    daysUntil("2027-08-12T00:00:00Z", Date.parse("2027-08-10T12:00:00Z")),
    2,
  );
  assert.equal(daysUntil("not-a-date"), undefined);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMbps,
  formatRouteValue,
  formatDateOnly,
  daysUntil,
  isFleetVisible,
  parseNodeMetadata,
} from "../src/theme-server-status/nodeMetadata.ts";

test("parses structured node metadata without depending on tag order", () => {
  assert.deepEqual(
    parseNodeMetadata("vpn; lifecycle=keep ; relay=sing-box; bw-up=100 ;role=dmca-resistant; bw-down=100;traffic-reset-day=12;traffic-reset-source=inferred;traffic-history-since=2026-09-13"),
    {
      bandwidthDownMbps: 100,
      bandwidthUpMbps: 100,
      lifecycle: "keep",
      relay: true,
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

test("recognizes only explicit relay tags", () => {
  assert.equal(parseNodeMetadata("relay=true").relay, true);
  assert.equal(parseNodeMetadata("relay=yes").relay, true);
  assert.equal(parseNodeMetadata("relay=no").relay, undefined);
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

test("parses directional China route metadata by carrier", () => {
  assert.deepEqual(
    parseNodeMetadata(
      "route-go-ct=CN2;route-back-ct=CN2 GIA;route-go-cu=4837;" +
      "route-back-cu=9929/4837;route-go-cm=CMIN2;route-back-cm=CMIN2;" +
      "route-sampled-at=2026-09-13;route-go-scope=广州电信/桂林联通/台山移动;" +
      "route-back-scope=北京/上海/广州/成都",
    ).chinaRoutes,
    {
      go: { ct: "CN2", cu: "4837", cm: "CMIN2" },
      back: { ct: "CN2 GIA", cu: "9929/4837", cm: "CMIN2" },
      sampledAt: "2026-09-13",
      goScope: "广州电信/桂林联通/台山移动",
      backScope: "北京/上海/广州/成都",
    },
  );
});

test("rejects malformed or oversized China route metadata", () => {
  assert.equal(
    parseNodeMetadata(
      `route-go-ct=${"x".repeat(41)};route-go-xx=CN2;route-sampled-at=2026/09/13`,
    ).chinaRoutes,
    undefined,
  );
});

test("formats canonical route evidence labels", () => {
  assert.equal(formatRouteValue("HIDDEN", true), "部分隐藏");
  assert.equal(formatRouteValue("CN2-163", true), "CN2/163动态");
  assert.equal(formatRouteValue("9929-163", false), "9929→163");
  assert.equal(formatRouteValue(undefined, false), "untested");
});

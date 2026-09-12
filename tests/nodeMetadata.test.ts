import assert from "node:assert/strict";
import test from "node:test";

import { formatMbps, parseNodeMetadata } from "../src/theme-server-status/nodeMetadata.ts";

test("parses structured node metadata without depending on tag order", () => {
  assert.deepEqual(
    parseNodeMetadata("vpn; lifecycle=keep ; bw-up=100 ;role=dmca-resistant; bw-down=100"),
    {
      bandwidthDownMbps: 100,
      bandwidthUpMbps: 100,
      lifecycle: "keep",
      role: "dmca-resistant",
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

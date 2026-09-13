import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const strip = fs.readFileSync(
  path.join(root, "src/theme-server-status/RelayStrip.tsx"),
  "utf8",
);
const table = fs.readFileSync(
  path.join(root, "src/theme-server-status/ServerTable.tsx"),
  "utf8",
);
const traffic = fs.readFileSync(
  path.join(root, "src/theme-server-status/relayTraffic.ts"),
  "utf8",
);
const index = fs.readFileSync(path.join(root, "src/pages/Index.tsx"), "utf8");
const css = fs.readFileSync(
  path.join(root, "src/theme-server-status/server-status.css"),
  "utf8",
);
const nav = fs.readFileSync(path.join(root, "src/components/NavBar.tsx"), "utf8");
const routes = fs.readFileSync(path.join(root, "src/routes.ts"), "utf8");

test("relay controls are merged into home and the old page redirects", () => {
  assert.doesNotMatch(nav, /to: "\/relays"/);
  assert.doesNotMatch(nav, /to: "\/network"/);
  assert.match(index, /<RelayStrip/);
  assert.match(routes, /path: "relays"/);
  assert.match(routes, /Navigate, \{ to: "\/#relays", replace: true \}/);
  assert.match(routes, /path: "network"[\s\S]*?Navigate, \{ to: "\/", replace: true \}/);
  assert.doesNotMatch(routes, /theme-server-status\/RelayPage/);
  assert.doesNotMatch(routes, /theme-server-status\/NetworkStatusPage/);
});

test("home strip uses live network data and contains no refresh control", () => {
  assert.match(strip, /record\?\.network\.down/);
  assert.match(strip, /record\?\.network\.up/);
  assert.doesNotMatch(strip, /\bcpu\b/i);
  assert.doesNotMatch(strip, /\bram\b/i);
  assert.doesNotMatch(strip, /refresh/i);
  assert.match(strip, /整机正在传输/);
});

test("relay rows use only network-driven blue states", () => {
  assert.match(traffic, /RELAY_ACTIVE_RATE = 128 \* 1024/);
  assert.match(traffic, /RELAY_FAST_RATE = 1024 \* 1024/);
  assert.doesNotMatch(traffic, /cpu|ram|memory|resource/i);
  assert.match(table, /is-relay-active/);
  assert.match(table, /is-relay-fast/);
  assert.match(css, /\.ss-node-row\.is-relay-active/);
  assert.match(css, /\.ss-node-row\.is-relay-fast/);
  assert.match(css, /@keyframes ssRelayRowBlue/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("strip keeps subscription actions without duplicating node cards", () => {
  assert.match(strip, /copySubscription/);
  assert.match(strip, /MANAGER_URL/);
  assert.doesNotMatch(strip, /RelayCard/);
  assert.doesNotMatch(strip, /useMonthlyTraffic/);
});

test("relay membership comes from an explicit safe metadata tag", () => {
  assert.match(strip, /parseNodeMetadata\(node\.tags\)\.relay/);
  assert.match(table, /metadata\.relay \? relayTrafficState/);
  assert.doesNotMatch(strip, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

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
  assert.ok(index.indexOf("<ServerTable") < index.indexOf("<RelayStrip"));
  assert.match(routes, /path: "relays"/);
  assert.match(routes, /Navigate, \{ to: "\/#relays", replace: true \}/);
  assert.match(routes, /path: "network"[\s\S]*?Navigate, \{ to: "\/", replace: true \}/);
  assert.doesNotMatch(routes, /theme-server-status\/RelayPage/);
  assert.doesNotMatch(routes, /theme-server-status\/NetworkStatusPage/);
});

test("home strip uses live network data and contains no refresh control", () => {
  assert.match(strip, /record\?\.network\.down/);
  assert.match(strip, /record\?\.network\.up/);
  assert.match(strip, /totalDownRate/);
  assert.match(strip, /totalUpRate/);
  assert.match(strip, /实时下载/);
  assert.match(strip, /实时上传/);
  assert.doesNotMatch(strip, /实时总速率/);
  assert.doesNotMatch(strip, /\bcpu\b/i);
  assert.doesNotMatch(strip, /\bram\b/i);
  assert.doesNotMatch(strip, /refresh/i);
  assert.match(strip, /整机正在传输/);
  assert.match(strip, /useMonthlyTraffic\(nodes\)/);
  assert.match(strip, /全部机器/);
  assert.match(strip, /中转节点/);
  assert.match(strip, /AVA 抗投诉/);
  assert.match(strip, /狗云入口/);
  assert.match(strip, /Breeze 计算/);
  assert.match(strip, /HostDizire 存储/);
  assert.match(strip, /本账期/);
  assert.match(css, /\.ss-relay-total\.is-fast/);
  assert.match(css, /@keyframes ssRelayTotalBlue/);
});

test("home table hides load while expanded details retain it", () => {
  assert.doesNotMatch(table, /<th className="ss-col-load"/);
  assert.doesNotMatch(table, /<td className="ss-col-load/);
  assert.match(table, /<DetailLine label=\{labels\.load\}>/);
  assert.match(table, /const columns = 15/);
});

test("quota bar shows the configured cap without approximation prefixes", () => {
  assert.match(table, /formatPercent\(remainingPercent\).*formatCompactBytes\(limit\)/s);
  assert.doesNotMatch(table, /label=\{`\$\{partial \? "~"/);
  assert.doesNotMatch(table, /`∞ · \$\{partial \? "~"/);
});

test("all node rows use only network-driven blue states", () => {
  assert.match(traffic, /RELAY_ACTIVE_RATE = 128 \* 1024/);
  assert.match(traffic, /RELAY_FAST_RATE = 1024 \* 1024/);
  assert.doesNotMatch(traffic, /cpu|ram|memory|resource/i);
  assert.match(table, /is-relay-active/);
  assert.match(table, /is-relay-fast/);
  assert.match(css, /\.ss-node-row\.is-relay-active/);
  assert.match(css, /\.ss-node-row\.is-relay-fast/);
  assert.match(css, /@keyframes ssRelayRowBlue/);
  assert.match(css, /@keyframes ssRelayRowBlueSoft/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("strip keeps subscription actions without duplicating node cards", () => {
  assert.match(strip, /copySubscription/);
  assert.match(strip, /MANAGER_URL/);
  assert.match(strip, /small\.bismih520\.com\/v2rayn-/);
  assert.match(strip, /v2rayN 订阅/);
  assert.doesNotMatch(strip, /RelayCard/);
  assert.match(strip, /useMonthlyTraffic/);
  assert.match(css, /\.ss-relay-strip[\s\S]*?background: transparent/);
  assert.match(css, /\.ss-relay-strip[\s\S]*?min-height: 50px/);
});

test("relay membership comes from an explicit safe metadata tag", () => {
  assert.match(strip, /parseNodeMetadata\(node\.tags\)\.relay/);
  assert.match(table, /const trafficState = relayTrafficState\(record, online\)/);
  assert.doesNotMatch(table, /metadata\.relay \? relayTrafficState/);
  assert.doesNotMatch(strip, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

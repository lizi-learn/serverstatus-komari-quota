import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src/theme-server-status/RelayPage.tsx"),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "src/theme-server-status/server-status.css"),
  "utf8",
);
const nav = fs.readFileSync(path.join(root, "src/components/NavBar.tsx"), "utf8");
const routes = fs.readFileSync(path.join(root, "src/routes.ts"), "utf8");

test("relay page is integrated into the Komari navigation", () => {
  assert.match(nav, /to: "\/relays"/);
  assert.match(routes, /path: "relays"/);
  assert.match(routes, /theme-server-status\/RelayPage/);
});

test("relay page uses live Komari records and contains no refresh control", () => {
  assert.match(source, /useLiveData\(\)/);
  assert.match(source, /record\?\.network\.down/);
  assert.match(source, /record\?\.network\.up/);
  assert.doesNotMatch(source, /className="[^"]*refresh/i);
  assert.doesNotMatch(source, /onClick=\{[^}]*refresh/i);
});

test("red blue and intermittent purple load states are implemented", () => {
  assert.match(source, /RESOURCE_HIGH = 75/);
  assert.match(source, /FAST_RATE = 1024 \* 1024/);
  for (const state of ["network", "resource", "combined"]) {
    assert.match(source, new RegExp(`return "${state}"`));
    assert.match(css, new RegExp(`\\.ss-relay-card\\.is-${state}`));
  }
  assert.match(css, /@keyframes ssRelayBlue/);
  assert.match(css, /@keyframes ssRelayRed/);
  assert.match(css, /@keyframes ssRelayPurple/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("cards and compact expandable list modes remain available", () => {
  assert.match(source, /type ViewMode = "cards" \| "list"/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(css, /\.ss-relay-grid\.is-list/);
  assert.match(css, /\.ss-relay-card\.is-compact/);
});

test("relay membership comes from an explicit safe metadata tag", () => {
  assert.match(source, /parseNodeMetadata\(node\.tags\)\.relay/);
  assert.doesNotMatch(source, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

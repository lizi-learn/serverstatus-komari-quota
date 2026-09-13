import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(
  path.join(root, "src/theme-server-status/server-status.css"),
  "utf8",
);

test("desktop status layout uses nearly the full viewport", () => {
  assert.match(
    css,
    /--ss-content-width:\s*min\(2200px, calc\(100vw - 24px\)\)/,
  );
  for (const selector of [".ss-navbar-inner", ".ss-main", ".ss-footer"]) {
    const escaped = selector.replace(".", "\\.");
    assert.match(
      css,
      new RegExp(
        `${escaped} \\{[^}]*width: var\\(--ss-content-width\\);[^}]*max-width: none;`,
        "s",
      ),
    );
  }
  assert.doesNotMatch(css, /max-width:\s*1680px/);
  assert.doesNotMatch(css, /width:\s*95vw/);
});

test("wide table keeps all columns and mobile keeps its compact viewport rule", () => {
  assert.match(css, /\.ss-table \{[^}]*min-width:\s*1760px;/s);
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.ss-main \{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
  );
  assert.match(css, /@container ss-panel \(max-width: 760px\)/);
});

test("overflowing desktop tables expose a draggable horizontal scrollbar", () => {
  assert.match(
    css,
    /\.ss-table-scroll \{[^}]*overflow-x:\s*auto;[^}]*scrollbar-width:\s*thin;/s,
  );
  assert.match(
    css,
    /\.ss-table-scroll::-webkit-scrollbar \{[^}]*height:\s*9px;/s,
  );
  assert.match(css, /\.ss-table-scroll::-webkit-scrollbar-thumb \{/);
  assert.doesNotMatch(
    css,
    /\.ss-table-scroll::-webkit-scrollbar \{[^}]*display:\s*none;/s,
  );
});

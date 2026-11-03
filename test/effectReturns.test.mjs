// Guard: React effects must not use an expression body. Whatever the expression returns becomes the
// effect cleanup — e.g. Chrome's scrollIntoView() now returns a Promise, which crashed /agent-inbox on
// unmount with "i is not a function" (BUG-30). Write `useEffect(() => { ... }, deps)` instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

test("no expression-bodied useEffect/useLayoutEffect in src", () => {
  const bad = [];
  for (const p of files("src")) {
    const s = readFileSync(p, "utf8");
    for (const m of s.matchAll(/use(?:Layout)?Effect\(\s*(?:async\s*)?\(\)\s*=>(?!\s*\{)/g)) {
      bad.push(`${p}:${s.slice(0, m.index).split("\n").length}`);
    }
    for (const m of s.matchAll(/use(?:Layout)?Effect\(\s*async/g)) bad.push(`${p}:${s.slice(0, m.index).split("\n").length} (async effect)`);
  }
  assert.deepEqual(bad, []);
});

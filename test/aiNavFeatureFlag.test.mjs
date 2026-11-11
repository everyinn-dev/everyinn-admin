import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { filterSidebarManagerItems, showMobileAiNavButton } from "../src/lib/adminNav.ts";
import { getAdminFeatureFlags, isAiNavEnabled, parseFeatureFlag, setTestFeatureEnv } from "../src/lib/features.ts";

const resolve = (rel) => fileURLToPath(new URL(rel, import.meta.url));

function stripJsonc(text) {
  let out = "";
  let inStr = false;
  let quote = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

test("parseFeatureFlag and isAiNavEnabled are fail-closed unless AI_NAV_ENABLED is 'true'", async () => {
  assert.equal(parseFeatureFlag(undefined), false);
  assert.equal(parseFeatureFlag(null), false);
  assert.equal(parseFeatureFlag("false"), false);
  assert.equal(parseFeatureFlag("1"), false);
  assert.equal(parseFeatureFlag("true"), true);
  assert.equal(parseFeatureFlag(" TRUE "), true);

  try {
    setTestFeatureEnv({});
    assert.equal(await isAiNavEnabled(), false);

    setTestFeatureEnv({ AI_NAV_ENABLED: "false" });
    assert.deepEqual(await getAdminFeatureFlags(), { aiNavEnabled: false });

    setTestFeatureEnv({ AI_NAV_ENABLED: "true" });
    assert.deepEqual(await getAdminFeatureFlags(), { aiNavEnabled: true });
  } finally {
    setTestFeatureEnv(null);
  }
});

test("filterSidebarManagerItems & showMobileAiNavButton hide AI menu entries while keeping Finance", () => {
  const managerItems = [
    { href: "/agent-inbox", label: "Hộp Thư AI" },
    { href: "/agent-config", label: "Cấu Hình AI" },
    { href: "/finance", label: "Tài Chính" },
  ];

  // Production manager (AI_NAV_ENABLED=false): AI items hidden, Finance remains
  assert.deepEqual(
    filterSidebarManagerItems(managerItems, { isManager: true, aiNavEnabled: false }).map((i) => i.href),
    ["/finance"],
  );
  assert.equal(showMobileAiNavButton({ isManager: true, aiNavEnabled: false }), false);

  // Dev/UAT manager (AI_NAV_ENABLED=true): all manager items shown
  assert.deepEqual(
    filterSidebarManagerItems(managerItems, { isManager: true, aiNavEnabled: true }).map((i) => i.href),
    ["/agent-inbox", "/agent-config", "/finance"],
  );
  assert.equal(showMobileAiNavButton({ isManager: true, aiNavEnabled: true }), true);

  // Receptionist: always hidden regardless of AI_NAV_ENABLED
  assert.deepEqual(filterSidebarManagerItems(managerItems, { isManager: false, aiNavEnabled: true }), []);
  assert.deepEqual(filterSidebarManagerItems(managerItems, { isManager: false, aiNavEnabled: false }), []);
  assert.equal(showMobileAiNavButton({ isManager: false, aiNavEnabled: true }), false);
});

test("wrangler.jsonc hides AI nav in prod top-level vars and keeps it enabled in env.dev for UAT", () => {
  const cfg = JSON.parse(stripJsonc(readFileSync(resolve("../wrangler.jsonc"), "utf8")));
  assert.equal(cfg.vars?.AI_NAV_ENABLED, "false");
  assert.equal(cfg.env?.dev?.vars?.AI_NAV_ENABLED, "true");
});


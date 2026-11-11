/**
 * Runtime feature flags backed by Cloudflare Worker `vars` (`wrangler.jsonc`).
 * Fail-closed (`false`) unless explicitly set to `"true"`.
 */
export interface AdminFeatureEnv {
  AI_NAV_ENABLED?: string;
}

export interface AdminFeatureFlags {
  aiNavEnabled: boolean;
}

let testFeatureEnv: AdminFeatureEnv | null = null;

/** Unit tests inject fake feature env vars without loading the OpenNext runtime. */
export function setTestFeatureEnv(env: AdminFeatureEnv | null): void {
  testFeatureEnv = env;
}

export function parseFeatureFlag(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export async function isAiNavEnabled(): Promise<boolean> {
  if (testFeatureEnv) {
    return parseFeatureFlag(testFeatureEnv.AI_NAV_ENABLED);
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const raw = (env as unknown as Record<string, string | undefined> | undefined)?.AI_NAV_ENABLED;
    if (raw !== undefined) return parseFeatureFlag(raw);
  } catch {
    // Non-Cloudflare runtime (Node tests / static build) falls back to process.env
  }
  return parseFeatureFlag(typeof process !== "undefined" ? process.env?.AI_NAV_ENABLED : undefined);
}

export async function getAdminFeatureFlags(): Promise<AdminFeatureFlags> {
  return {
    aiNavEnabled: await isAiNavEnabled(),
  };
}


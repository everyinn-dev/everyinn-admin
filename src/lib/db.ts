import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb(): Promise<D1Database> {
  const ctx = await getCloudflareContext({ async: true });
  const db = ctx?.env?.DB || (ctx?.env as any)?.everyinn_admin;
  if (!db) {
    throw new Error("D1 Database binding 'DB' not found in Cloudflare context.");
  }
  return db;
}

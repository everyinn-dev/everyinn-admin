import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb(): Promise<D1Database> {
  const ctx = await getCloudflareContext({ async: true });
  if (!ctx?.env?.DB) {
    throw new Error("D1 Database binding 'DB' not found in Cloudflare context.");
  }
  return ctx.env.DB;
}

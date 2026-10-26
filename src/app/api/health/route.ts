import { sql } from "@/lib/db";

// Public keep-alive for an uptime pinger: one tiny query keeps the Neon
// database and the function warm, so the next real visit doesn't wait for them.
export async function GET() {
  const t0 = Date.now();
  await sql`select 1`;
  return Response.json({ ok: true, dbMs: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
}

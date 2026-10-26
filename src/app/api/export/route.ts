import { buildExport } from "@/lib/export";
import { requireToday } from "@/lib/session";

export async function GET(request: Request) {
  const { userId, today } = await requireToday();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { markdown, filename } = await buildExport(userId, today, params);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

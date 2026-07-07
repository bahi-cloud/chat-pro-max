import { db } from "@/db";
import { tools } from "@/db/schema";
import { getOrCreateToolsConfig } from "@/lib/tools";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ينفّذ أداة عبر خادم الأدوات الخارجي، لكن بعد التحقق أولاً من قاعدة
// البيانات أن الأداة معروفة ومُفعَّلة — هذا يفرض التعطيل فعلياً على مستوى
// الخادم، وليس فقط إخفاءً في الواجهة.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.tool || "");
    const args = body?.arguments || {};
    if (!name) return Response.json({ detail: "اسم الأداة مطلوب" }, { status: 400 });

    const rows = await db.select().from(tools).where(eq(tools.name, name)).limit(1);
    if (rows.length && rows[0].enabled === false) {
      return Response.json({ detail: `الأداة "${name}" معطَّلة حالياً من الإعدادات` }, { status: 403 });
    }

    const config = await getOrCreateToolsConfig();
    const base = config.serverUrl.trim().replace(/\/+$/, "");
    if (!base) return Response.json({ detail: "رابط خادم الأدوات غير مضبوط" }, { status: 400 });

    const upstream = await fetch(`${base}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: name, arguments: args }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}));

    const result = data.result ?? data;
    if (result && typeof result === "object" && typeof result.file_url === "string") {
      result.file_url = result.file_url.startsWith("http") ? result.file_url : `${base}${result.file_url}`;
    }

    return Response.json({ result }, { status: upstream.status });
  } catch (err) {
    return Response.json({ detail: (err as Error).message }, { status: 502 });
  }
}

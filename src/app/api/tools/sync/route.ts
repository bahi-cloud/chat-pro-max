import { db } from "@/db";
import { toolsConfig } from "@/db/schema";
import { getOrCreateToolsConfig, syncToolsFromServer } from "@/lib/tools";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// يتصل بخادم الأدوات الخارجي، ويسحب أي أداة جديدة تلقائياً، ويحفظها في
// قاعدة البيانات. يُستدعى يدوياً بزر "مزامنة الآن" أو تلقائياً بشكل دوري
// من الواجهة عند تفعيل خيار "السحب التلقائي".
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.serverUrl === "string" && body.serverUrl.trim()) {
      const config = await getOrCreateToolsConfig();
      await db
        .update(toolsConfig)
        .set({ serverUrl: body.serverUrl.trim().replace(/\/+$/, "") })
        .where(eq(toolsConfig.id, config.id));
    }

    const { rows, added, total, config } = await syncToolsFromServer();
    return Response.json({ ok: true, tools: rows, added, total, config });
  } catch (err) {
    try {
      const config = await getOrCreateToolsConfig();
      await db
        .update(toolsConfig)
        .set({ lastSyncStatus: "error", lastSyncError: (err as Error).message, lastSyncAt: new Date() })
        .where(eq(toolsConfig.id, config.id));
    } catch {
      /* تجاهل أي خطأ ثانوي أثناء تسجيل حالة الفشل */
    }
    return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}

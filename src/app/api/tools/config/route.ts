import { db } from "@/db";
import { toolsConfig } from "@/db/schema";
import { getOrCreateToolsConfig } from "@/lib/tools";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getOrCreateToolsConfig();
    return Response.json({ ok: true, config });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

// يحدّث إعدادات خادم الأدوات: الرابط، تفعيل/تعطيل السحب التلقائي،
// وهل الأدوات الجديدة تُفعَّل تلقائياً عند اكتشافها.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = await getOrCreateToolsConfig();
    const patch: Partial<typeof toolsConfig.$inferInsert> = {};

    if (typeof body?.serverUrl === "string" && body.serverUrl.trim()) {
      patch.serverUrl = body.serverUrl.trim().replace(/\/+$/, "");
    }
    if (typeof body?.autoSyncEnabled === "boolean") patch.autoSyncEnabled = body.autoSyncEnabled;
    if (typeof body?.autoEnableNewTools === "boolean") patch.autoEnableNewTools = body.autoEnableNewTools;
    if (typeof body?.syncIntervalSeconds === "number" && body.syncIntervalSeconds >= 5) {
      patch.syncIntervalSeconds = Math.floor(body.syncIntervalSeconds);
    }

    const rows = await db.update(toolsConfig).set(patch).where(eq(toolsConfig.id, config.id)).returning();
    return Response.json({ ok: true, config: rows[0] });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

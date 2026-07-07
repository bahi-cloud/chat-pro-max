import { db } from "@/db";
import { tools } from "@/db/schema";
import { getOrCreateToolsConfig } from "@/lib/tools";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// يعيد القائمة الحالية للأدوات المخزّنة في قاعدة البيانات مع إعدادات
// المزامنة، دون الاتصال بالخادم الخارجي (سريع، يُستخدم للتحديث الدوري للواجهة).
export async function GET() {
  try {
    const [rows, config] = await Promise.all([
      db.select().from(tools).orderBy(desc(tools.lastSeenAt)),
      getOrCreateToolsConfig(),
    ]);
    return Response.json({ ok: true, tools: rows, config });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

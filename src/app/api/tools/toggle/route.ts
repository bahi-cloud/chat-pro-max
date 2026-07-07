import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// تفعيل أو تعطيل أداة واحدة بشكل مستقل. الأداة المعطَّلة تختفي فوراً من
// قائمة (+) في المحادثة، ويرفض الخادم تنفيذها حتى لو حاول النموذج استدعاءها.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "");
    const enabled = Boolean(body?.enabled);
    if (!name) return Response.json({ ok: false, error: "اسم الأداة مطلوب" }, { status: 400 });

    const rows = await db
      .update(tools)
      .set({ enabled, isNew: false })
      .where(eq(tools.name, name))
      .returning();

    if (!rows.length) return Response.json({ ok: false, error: "الأداة غير موجودة" }, { status: 404 });
    return Response.json({ ok: true, tool: rows[0] });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

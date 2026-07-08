import { db } from "@/db";
import { tools, toolsConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export const DEFAULT_TOOLS_SERVER_URL = "https://ayb-bh92-tools.hf.space";

/** يصنّف اسم الأداة تلقائياً إلى فئة لعرضها بشكل منظم في الواجهة.
 * أي أداة جديدة غير معروفة تُصنَّف تلقائياً ضمن "other" دون أي تعديل يدوي. */
export function categorizeTool(name: string): string {
  if (name.startsWith("firecrawl_")) return "webSearch";
  if (name.startsWith("context7_")) return "context7";
  if (name.startsWith("composio_")) return "composio";
  if (name === "health_check") return "system";
  const documentTools = [
    "create_docx",
    "create_pptx",
    "create_pdf",
    "read_pdf",
    "pdf_info",
    "create_xlsx",
    "read_xlsx",
    "markdown_to_html",
  ];
  if (documentTools.includes(name)) return "documents";
  const videoKeywords = [
    "video",
    "audio",
    "subtitle",
    "overlay",
    "concatenate",
    "silence",
    "b_roll",
    "transition",
    "aspect_ratio",
  ];
  if (videoKeywords.some((k) => name.includes(k))) return "video";
  return "other";
}

export async function getOrCreateToolsConfig() {
  const existing = await db.select().from(toolsConfig).limit(1);
  if (existing.length) return existing[0];
  const inserted = await db
    .insert(toolsConfig)
    .values({ serverUrl: DEFAULT_TOOLS_SERVER_URL })
    .returning();
  return inserted[0];
}

export type ExternalToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
};

/** يجلب `url` مع مهلة زمنية محددة (بالمللي ثانية). إن تجاوز الخادم هذه
 * المهلة، يُلغى الطلب برمي خطأ بدل الانتظار إلى ما لا نهاية. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; chat-tools-sync/1.0)",
      },
    });
  } finally {
    clearTimeout(id);
  }
}

/** يجلب قائمة الأدوات من خادم الأدوات الخارجي ويُدرِج أي أداة جديدة تلقائياً
 * في قاعدة البيانات، مع الحفاظ على حالة التفعيل/التعطيل للأدوات الموجودة.
 *
 * يحاول مرتين: محاولة أولى سريعة (9 ثوانٍ)، وإن فشلت (غالباً لأن خادم
 * Hugging Face Space كان نائماً وبدأ يستيقظ الآن) يعيد المحاولة بمهلة
 * أطول (20 ثانية) لإعطاء الخادم فرصة حقيقية للاستجابة. */
export async function syncToolsFromServer() {
  const config = await getOrCreateToolsConfig();
  const base = config.serverUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("رابط خادم الأدوات غير مضبوط");

  // محاولة واحدة فقط بمهلة أقل من حد Netlify الصارم (10 ثوانٍ على الخطة
  // المجانية) — أي إعادة محاولة تتجاوز هذا الحد تجعل Netlify نفسها توقف
  // الدالة وترجع صفحة خطأ HTML بدل JSON.
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/tools`, 8000);
  } catch (err) {
    throw new Error(
      `تعذّر الوصول لخادم الأدوات خلال 8 ثوانٍ (قد يكون نائماً على Hugging Face): ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${bodyText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { tools?: ExternalToolDef[] };
  const externalTools = data.tools || [];

  const existingRows = await db.select().from(tools);
  const existingByName = new Map(existingRows.map((r) => [r.name, r]));
  let added = 0;

  for (const t of externalTools) {
    const name = t.function?.name;
    if (!name) continue;
    const description = t.function?.description || "";
    const category = categorizeTool(name);
    const parameters = t.function?.parameters ?? {};
    const existing = existingByName.get(name);

    if (existing) {
      await db
        .update(tools)
        .set({ description, category, parameters, lastSeenAt: new Date() })
        .where(eq(tools.id, existing.id));
    } else {
      added += 1;
      await db.insert(tools).values({
        name,
        description,
        category,
        parameters,
        enabled: config.autoEnableNewTools,
        isNew: true,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      });
    }
  }

  await db
    .update(toolsConfig)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: "ok",
      lastSyncError: null,
      toolsCount: externalTools.length,
    })
    .where(eq(toolsConfig.id, config.id));

  const finalRows = await db.select().from(tools);
  return { rows: finalRows, added, total: externalTools.length, config: await getOrCreateToolsConfig() };
}

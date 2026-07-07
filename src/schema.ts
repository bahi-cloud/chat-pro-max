import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// كتالوج الأدوات الذي يُسحب تلقائياً من خادم الأدوات الخارجي (Tools Server).
// كل أداة جديدة تظهر في الخادم الخارجي تُدرَج هنا تلقائياً عند كل مزامنة،
// ويمكن تفعيلها أو تعطيلها بشكل مستقل من واجهة الإعدادات.
export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  parameters: jsonb("parameters"),
  enabled: boolean("enabled").notNull().default(true),
  isNew: boolean("is_new").notNull().default(true),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

// صف إعداد وحيد يخزّن رابط خادم الأدوات وحالة المزامنة التلقائية.
export const toolsConfig = pgTable("tools_config", {
  id: serial("id").primaryKey(),
  serverUrl: text("server_url").notNull().default("https://ayb-bh92-tools.hf.space"),
  autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(true),
  autoEnableNewTools: boolean("auto_enable_new_tools").notNull().default(true),
  syncIntervalSeconds: integer("sync_interval_seconds").notNull().default(20),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  toolsCount: integer("tools_count").notNull().default(0),
});

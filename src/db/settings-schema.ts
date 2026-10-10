import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reportSettings = sqliteTable("report_settings", {
  id: text("id").primaryKey(),
  headerTitle: text("header_title").notNull(),
  headerSubtitle: text("header_subtitle"),
  footerText: text("footer_text"),
  logoUri: text("logo_uri"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const accountOpeningBalances = sqliteTable("account_opening_balances", {
  id: text("id").primaryKey(),
  accountCode: text("account_code").notNull().unique(),
  debit: real("debit").notNull().default(0),
  credit: real("credit").notNull().default(0),
  currencyCode: text("currency_code").notNull().default("SAR"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const itemOpeningBalances = sqliteTable("item_opening_balances", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().unique(),
  quantity: real("quantity").notNull().default(0),
  unitCost: real("unit_cost").notNull().default(0),
  warehouseId: text("warehouse_id").notNull().default("wip-main"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

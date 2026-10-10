import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  itemType: text("item_type").notNull(),
  unit: text("unit").notNull(),
  stockQuantity: real("stock_quantity").notNull().default(0),
  averageCost: real("average_cost").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const warehouses = sqliteTable("warehouses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  warehouseType: text("warehouse_type").notNull(),
});

export const productBoms = sqliteTable("product_boms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  finishedItemId: text("finished_item_id").notNull(),
  version: integer("version").notNull().default(1),
  outputQuantity: real("output_quantity").notNull().default(1),
  outputUnit: text("output_unit").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const productBomLines = sqliteTable("product_bom_lines", {
  id: text("id").primaryKey(),
  bomId: text("bom_id").notNull(),
  componentItemId: text("component_item_id").notNull(),
  quantityPerOutput: real("quantity_per_output").notNull(),
  unit: text("unit").notNull(),
  wastePercent: real("waste_percent").notNull().default(0),
});

export const stockReceipts = sqliteTable("stock_receipts", {
  id: text("id").primaryKey(),
  receiptNo: text("receipt_no").notNull().unique(),
  sourceName: text("source_name"),
  warehouseId: text("warehouse_id").notNull(),
  status: text("status").notNull().default("draft"),
  syncStatus: text("sync_status").notNull().default("pending"),
  totalCost: real("total_cost").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const stockReceiptLines = sqliteTable("stock_receipt_lines", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull(),
  itemId: text("item_id").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  unitCost: real("unit_cost").notNull(),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  itemId: text("item_id").notNull(),
  warehouseId: text("warehouse_id").notNull(),
  movementType: text("movement_type").notNull(),
  quantityIn: real("quantity_in").notNull().default(0),
  quantityOut: real("quantity_out").notNull().default(0),
  plannedQuantity: real("planned_quantity").notNull().default(0),
  wasteQuantity: real("waste_quantity").notNull().default(0),
  unitCost: real("unit_cost").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const syncQueue = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operationId: text("operation_id").notNull().unique(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operationType: text("operation_type").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Item = typeof items.$inferSelect;
export type StockReceipt = typeof stockReceipts.$inferSelect;
export type ProductBom = typeof productBoms.$inferSelect;

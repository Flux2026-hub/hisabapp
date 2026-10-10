import { eq } from "drizzle-orm";
import { db } from "../db/local";
import { items, productBomLines, productBoms, stockMovements, stockReceiptLines, stockReceipts, syncQueue } from "../db/schema";

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function createLocalStockReceipt(input: { sourceName?: string; itemId: string; warehouseId: string; quantity: number; unit: string; unitCost: number }) {
  if (input.quantity <= 0 || input.unitCost <= 0) throw new Error("الكمية والتكلفة يجب أن تكونا أكبر من صفر");
  const receiptId = id(), operationId = id(), now = new Date(), receiptNo = `GR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, totalCost = input.quantity * input.unitCost;
  await db.insert(stockReceipts).values({ id: receiptId, receiptNo, sourceName: input.sourceName, warehouseId: input.warehouseId, status: "draft", syncStatus: "pending", totalCost, createdAt: now });
  await db.insert(stockReceiptLines).values({ id: id(), receiptId, itemId: input.itemId, quantity: input.quantity, unit: input.unit, unitCost: input.unitCost });
  await db.insert(stockMovements).values({ id: id(), sourceType: "stock_receipt", sourceId: receiptId, itemId: input.itemId, warehouseId: input.warehouseId, movementType: "receipt_pending", quantityIn: input.quantity, quantityOut: 0, unitCost: input.unitCost, createdAt: now });
  await db.insert(syncQueue).values({ operationId, entityType: "stock_receipt", entityId: receiptId, operationType: "create", payload: JSON.stringify({ receiptId, receiptNo, ...input, totalCost }), status: "pending", attempts: 0, createdAt: now, updatedAt: now });
  return { receiptId, receiptNo, operationId };
}

export async function createLocalRecipe(input: { name: string; finishedItemId: string; outputQuantity: number; outputUnit: string; lines: Array<{ componentItemId: string; quantityPerOutput: number; unit: string; wastePercent: number }> }) {
  if (!input.name || input.lines.length === 0) throw new Error("الوصفة تحتاج اسمًا ومكونًا واحدًا على الأقل");
  const bomId = id(), now = new Date();
  await db.insert(productBoms).values({ id: bomId, name: input.name, finishedItemId: input.finishedItemId, version: 1, outputQuantity: input.outputQuantity, outputUnit: input.outputUnit, effectiveFrom: now.toISOString().slice(0, 10), isActive: true });
  await db.insert(productBomLines).values(input.lines.map((line) => ({ id: id(), bomId, ...line })));
  const operationId = id();
  await db.insert(syncQueue).values({ operationId, entityType: "recipe", entityId: bomId, operationType: "create", payload: JSON.stringify({ bomId, ...input }), status: "pending", attempts: 0, createdAt: now, updatedAt: now });
  return { bomId, operationId };
}

export async function createProductionIssue(input: { issueNo: string; bomId: string; warehouseId: string; outputQuantity: number; lines: Array<{ itemId: string; quantityPerOutput: number; unit: string; unitCost: number; wastePercent: number }> }) {
  if (input.outputQuantity <= 0 || input.lines.length === 0) throw new Error("أدخل كمية إنتاج ومكونات صحيحة");
  const issueId = id(), operationId = id(), now = new Date();
  for (const line of input.lines) {
    const baseQuantity = line.quantityPerOutput * input.outputQuantity; const quantity = baseQuantity * (1 + line.wastePercent / 100); const wasteQuantity = quantity - baseQuantity;
    const current = (await db.select().from(items).where(eq(items.id, line.itemId)).limit(1))[0];
    if (!current || current.stockQuantity < quantity) throw new Error(`الرصيد غير كافٍ للصنف ${line.itemId}`);
    await db.update(items).set({ stockQuantity: current.stockQuantity - quantity, updatedAt: now }).where(eq(items.id, line.itemId));
    await db.insert(stockMovements).values({ id: id(), sourceType: "production_issue", sourceId: issueId, itemId: line.itemId, warehouseId: input.warehouseId, movementType: "issue_pending", quantityIn: 0, quantityOut: quantity, plannedQuantity: baseQuantity, wasteQuantity, unitCost: line.unitCost, createdAt: now });
  }
  const syncLines = input.lines.map((line) => { const plannedQuantity = line.quantityPerOutput * input.outputQuantity; const quantity = plannedQuantity * (1 + line.wastePercent / 100); return { itemId: line.itemId, quantity, plannedQuantity, wasteQuantity: quantity - plannedQuantity, unit: line.unit, unitCost: line.unitCost }; });
  await db.insert(syncQueue).values({ operationId, entityType: "production_issue", entityId: issueId, operationType: "create", payload: JSON.stringify({ issueId, issueNo: input.issueNo, bomId: input.bomId, warehouseId: input.warehouseId, outputQuantity: input.outputQuantity, lines: syncLines }), status: "pending", attempts: 0, createdAt: now, updatedAt: now });
  return { issueId, operationId };
}

export async function processSyncQueue(apiBaseUrl: string) {
  const pending = await db.select().from(syncQueue).where(eq(syncQueue.status, "pending")).limit(20);
  for (const operation of pending) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sync/push`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": operation.operationId }, body: JSON.stringify({ operationId: operation.operationId, deviceId: "android-device", companyId: 1, entityType: operation.entityType, operationType: operation.operationType, payload: JSON.parse(operation.payload) }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await db.update(syncQueue).set({ status: "synced", updatedAt: new Date() }).where(eq(syncQueue.id, operation.id));
      if (operation.entityType === "stock_receipt") await db.update(stockReceipts).set({ syncStatus: "synced" }).where(eq(stockReceipts.id, operation.entityId));
    } catch (error) {
      await db.update(syncQueue).set({ status: "failed", attempts: operation.attempts + 1, lastError: String(error), updatedAt: new Date() }).where(eq(syncQueue.id, operation.id));
    }
  }
}

export async function getPendingSyncCount() {
  const pending = await db.select().from(syncQueue).where(eq(syncQueue.status, "pending"));
  return pending.length;
}

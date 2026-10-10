import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { productBomLines, productBoms, stockBalances, stockMovements, stockReceiptLines, stockReceipts, syncOperations } from "../drizzle/schema";

type ReceiptPayload = { receiptNo: string; sourceName?: string; warehouseId: string | number; itemId: string | number; quantity: number; unit: string; unitCost: number; totalCost?: number };
type RecipePayload = { bomId: string; name: string; finishedItemId: string; outputQuantity: number; outputUnit: string; lines: Array<{ componentItemId: string; quantityPerOutput: number; unit: string; wastePercent: number }> };
type IssuePayload = { issueNo: string; warehouseId: string | number; bomId?: string; outputQuantity?: number; lines: Array<{ itemId: string; quantity: number; plannedQuantity: number; wasteQuantity: number; unit: string; unitCost: number }> };
type SyncBody = { operationId: string; deviceId?: string; companyId?: number; entityType: string; operationType: string; payload: ReceiptPayload | IssuePayload | RecipePayload };

async function updateBalance(tx: any, companyId: number, warehouseId: string, itemId: string, quantityDelta: number, unitCost: number, movement: "in" | "out") {
  const rows = await tx.select().from(stockBalances).where(and(eq(stockBalances.companyId, companyId), eq(stockBalances.warehouseId, warehouseId), eq(stockBalances.itemId, itemId))).for("update");
  const current = rows[0];
  const oldQuantity = Number(current?.quantity ?? 0);
  const oldAverageCost = Number(current?.averageCost ?? 0);
  if (movement === "out" && oldQuantity < quantityDelta) throw new Error(`Insufficient stock for item ${itemId}`);
  const newQuantity = movement === "in" ? oldQuantity + quantityDelta : oldQuantity - quantityDelta;
  const newAverageCost = movement === "in" && newQuantity > 0 ? ((oldQuantity * oldAverageCost) + (quantityDelta * unitCost)) / newQuantity : oldAverageCost;
  if (current) await tx.update(stockBalances).set({ quantity: String(newQuantity), averageCost: String(newAverageCost), updatedAt: new Date() }).where(eq(stockBalances.id, current.id));
  else if (movement === "in") await tx.insert(stockBalances).values({ companyId, warehouseId, itemId, quantity: String(quantityDelta), averageCost: String(unitCost) });
  return { oldQuantity, newQuantity, averageCost: newAverageCost };
}

export async function pushSyncOperation(body: SyncBody) {
  const companyId = body.companyId ?? 1;
  const deviceId = body.deviceId ?? "android-device";
  const existing = await db.select().from(syncOperations).where(eq(syncOperations.operationId, body.operationId)).limit(1);
  if (existing[0]) return { status: "synced", duplicate: true, data: existing[0].responsePayload ? JSON.parse(existing[0].responsePayload) : null };

  return db.transaction(async (tx) => {
    const p = body.payload;
    let response: Record<string, unknown>;
    if (body.entityType === "stock_receipt" && body.operationType === "create") {
      const receipt = p as ReceiptPayload;
      if (!receipt.receiptNo || receipt.quantity <= 0 || receipt.unitCost <= 0) throw new Error("Invalid stock receipt payload");
      const inserted = await tx.insert(stockReceipts).values({ companyId, receiptNo: receipt.receiptNo, sourceName: receipt.sourceName, warehouseId: String(receipt.warehouseId), totalCost: String(receipt.totalCost ?? receipt.quantity * receipt.unitCost), status: "posted" });
      const receiptId = Number((inserted as any)[0]?.insertId ?? 0);
      await tx.insert(stockReceiptLines).values({ receiptId, itemId: String(receipt.itemId), quantity: String(receipt.quantity), unit: receipt.unit, unitCost: String(receipt.unitCost) });
      const balance = await updateBalance(tx, companyId, String(receipt.warehouseId), String(receipt.itemId), receipt.quantity, receipt.unitCost, "in");
      await tx.insert(stockMovements).values({ companyId, sourceType: "stock_receipt", sourceId: receiptId, itemId: String(receipt.itemId), warehouseId: String(receipt.warehouseId), movementType: "purchase_receipt", quantityIn: String(receipt.quantity), quantityOut: "0", unitCost: String(receipt.unitCost), totalCost: String(receipt.totalCost ?? receipt.quantity * receipt.unitCost) });
      response = { receiptId, receiptNo: receipt.receiptNo, status: "posted", balance };
    } else if (body.entityType === "recipe" && body.operationType === "create") {
      const recipe = p as RecipePayload;
      if (!recipe.bomId || !recipe.name || recipe.lines.length === 0) throw new Error("Invalid recipe payload");
      await tx.insert(productBoms).values({ id: recipe.bomId, companyId, name: recipe.name, finishedItemId: recipe.finishedItemId, version: 1, outputQuantity: String(recipe.outputQuantity), outputUnit: recipe.outputUnit, isActive: true });
      await tx.insert(productBomLines).values(recipe.lines.map((line) => ({ id: `${recipe.bomId}-${line.componentItemId}`, bomId: recipe.bomId, componentItemId: line.componentItemId, quantityPerOutput: String(line.quantityPerOutput), unit: line.unit, wastePercent: String(line.wastePercent) })));
      response = { bomId: recipe.bomId, status: "synced", lines: recipe.lines.length };
    } else if (body.entityType === "production_issue" && body.operationType === "create") {
      const issue = p as IssuePayload;
      if (!issue.issueNo || issue.outputQuantity! <= 0 || !issue.lines?.length) throw new Error("Invalid production issue payload");
      const balances = [];
      for (const line of issue.lines) {
        if (line.quantity <= 0) throw new Error("Invalid issue line quantity");
        const balance = await updateBalance(tx, companyId, String(issue.warehouseId), String(line.itemId), line.quantity, line.unitCost, "out");
        balances.push({ itemId: line.itemId, balance });
        await tx.insert(stockMovements).values({ companyId, sourceType: "production_issue", sourceId: 0, itemId: String(line.itemId), warehouseId: String(issue.warehouseId), movementType: "production_issue", quantityIn: "0", quantityOut: String(line.quantity), plannedQuantity: String(line.plannedQuantity), wasteQuantity: String(line.wasteQuantity), unitCost: String(line.unitCost), totalCost: String(line.quantity * line.unitCost) });
      }
      response = { issueNo: issue.issueNo, status: "posted", balances };
    } else throw new Error("Unsupported sync operation");
    await tx.insert(syncOperations).values({ operationId: body.operationId, deviceId, companyId, entityType: body.entityType, operationType: body.operationType, status: "synced", responsePayload: JSON.stringify(response), processedAt: new Date() });
    return { status: "synced", duplicate: false, data: response };
  });
}

import "dotenv/config";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { pushSyncOperation } from "./sync";
import { sendConsumptionReport } from "./whatsapp";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "hisabapp-api" }));

app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/api/whatsapp/webhook", (req, res) => {
  console.log("WhatsApp webhook event", JSON.stringify(req.body));
  return res.sendStatus(200);
});

app.post("/api/reports/material-consumption/send-whatsapp", async (req, res) => {
  try {
    const internalKey = process.env.REPORT_SEND_API_KEY;
    if (internalKey && req.header("x-internal-api-key") !== internalKey) return res.status(401).json({ error: "Unauthorized" });
    const { companyId = 1, from, to, recipient, recipientName } = req.body ?? {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to)) || !/^\+?[1-9]\d{7,14}$/.test(String(recipient))) return res.status(400).json({ error: "from, to and recipient are invalid" });
    const result = await sendConsumptionReport({ companyId: Number(companyId), from: String(from), to: String(to), recipient: String(recipient), recipientName: recipientName ? String(recipientName) : undefined });
    return res.json({ status: "sent", ...result });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: error instanceof Error ? error.message : "WhatsApp delivery failed" });
  }
});

app.post("/api/sync/push", async (req, res) => {
  const operationId = req.header("Idempotency-Key") ?? req.body?.operationId;
  try {
    if (!operationId) return res.status(400).json({ error: "Idempotency-Key is required" });
    const result = await pushSyncOperation({ ...req.body, operationId });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Sync failed" });
  }
});

app.get("/api/reports/trial-balance", async (req, res) => {
  const companyId = Number(req.query.companyId ?? 1);
  const rows = await db.execute(sql`
    SELECT a.id, a.code, a.name,
      COALESCE(SUM(jel.debit), 0) AS debit,
      COALESCE(SUM(jel.credit), 0) AS credit
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    WHERE a.company_id = ${companyId}
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `);
  return res.json(rows[0] ?? rows);
});

app.get("/api/reports/material-consumption", async (req, res) => {
  const companyId = Number(req.query.companyId ?? 1);
  const from = String(req.query.from ?? "2000-01-01");
  const to = String(req.query.to ?? "2100-01-01");
  const rows = await db.execute(sql`
    SELECT sm.itemId, sm.warehouseId,
      SUM(sm.plannedQuantity) AS plannedQuantity,
      SUM(sm.quantityOut) AS consumedQuantity,
      SUM(sm.wasteQuantity) AS wasteQuantity,
      SUM(sm.totalCost) AS totalCost,
      COUNT(*) AS movementCount
    FROM stock_movements sm
    WHERE sm.companyId = ${companyId}
      AND sm.movementType = 'production_issue'
      AND DATE(sm.createdAt) BETWEEN ${from} AND ${to}
    GROUP BY sm.itemId, sm.warehouseId
    ORDER BY sm.itemId
  `);
  return res.json({ from, to, rows: rows[0] ?? rows });
});

app.get("/api/reports/cashboxes", async (req, res) => {
  const companyId = Number(req.query.companyId ?? 1);
  const rows = await db.execute(sql`
    SELECT c.id, c.parent_id, c.name, c.cashbox_type,
      COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
    FROM cashboxes c
    LEFT JOIN journal_entry_lines jel ON jel.account_id = c.account_id
    WHERE c.company_id = ${companyId} AND c.is_active = 1
    GROUP BY c.id, c.parent_id, c.name, c.cashbox_type
    ORDER BY c.parent_id, c.name
  `);
  return res.json(rows[0] ?? rows);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => console.log(`HisabApp API listening on ${port}`));

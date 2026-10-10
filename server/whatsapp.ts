import PDFDocument from "pdfkit";
import { sql } from "drizzle-orm";
import { db } from "./db";

type ConsumptionRow = {
  itemId: string;
  warehouseId: string;
  plannedQuantity: string | number;
  consumedQuantity: string | number;
  wasteQuantity: string | number;
  totalCost: string | number;
  movementCount: string | number;
};

type SendReportInput = {
  companyId: number;
  from: string;
  to: string;
  recipient: string;
  recipientName?: string;
};

const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v26.0";
const graphBase = `https://graph.facebook.com/${graphVersion}`;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function number(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function getConsumptionRows(companyId: number, from: string, to: string): Promise<ConsumptionRow[]> {
  const result = await db.execute(sql`
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
  return ((result as any)[0] ?? result) as unknown as ConsumptionRow[];
}

export async function createConsumptionPdf(input: SendReportInput, rows: ConsumptionRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 42 });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    if (process.env.REPORT_PDF_FONT_PATH) document.font(process.env.REPORT_PDF_FONT_PATH);
    document.fontSize(18).text("Raw Material Consumption and Waste Report", { align: "center" });
    document.moveDown(0.5);
    document.fontSize(10).text(`Period: ${input.from} to ${input.to}`, { align: "center" });
    document.moveDown();
    document.fontSize(10);
    document.text("Item | Warehouse | Planned | Consumed | Waste | Cost");
    document.moveDown(0.5);

    for (const row of rows) {
      document.text([
        row.itemId,
        row.warehouseId,
        number(row.plannedQuantity).toFixed(3),
        number(row.consumedQuantity).toFixed(3),
        number(row.wasteQuantity).toFixed(3),
        number(row.totalCost).toFixed(2),
      ].join(" | "));
      document.moveDown(0.25);
    }

    const totalWaste = rows.reduce((sum, row) => sum + number(row.wasteQuantity), 0);
    const totalCost = rows.reduce((sum, row) => sum + number(row.totalCost), 0);
    document.moveDown();
    document.text(`Total waste: ${totalWaste.toFixed(3)}`);
    document.text(`Total cost: ${totalCost.toFixed(2)}`);
    document.end();
  });
}

async function uploadMedia(pdf: Buffer, filename: string): Promise<string> {
  const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);

  const response = await fetch(`${graphBase}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !body.id) throw new Error(`WhatsApp media upload failed: ${body.error?.message ?? response.statusText}`);
  return body.id;
}

async function sendTemplate(input: SendReportInput, mediaId: string, filename: string): Promise<string> {
  const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const templateName = process.env.WHATSAPP_REPORT_TEMPLATE ?? "inventory_consumption_report";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "ar";

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "header",
          parameters: [{ type: "document", document: { id: mediaId, filename } }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: input.recipientName ?? "عميلنا" },
            { type: "text", text: input.from },
            { type: "text", text: input.to },
          ],
        },
      ],
    },
  };

  const response = await fetch(`${graphBase}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  const messageId = body.messages?.[0]?.id;
  if (!response.ok || !messageId) throw new Error(`WhatsApp message failed: ${body.error?.message ?? response.statusText}`);
  return messageId;
}

export async function sendConsumptionReport(input: SendReportInput) {
  const rows = await getConsumptionRows(input.companyId, input.from, input.to);
  const pdf = await createConsumptionPdf(input, rows);
  const filename = `consumption-report-${input.from}-${input.to}.pdf`;
  const mediaId = await uploadMedia(pdf, filename);
  const messageId = await sendTemplate(input, mediaId, filename);
  return { messageId, mediaId, filename, rowCount: rows.length, from: input.from, to: input.to };
}

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export type PrintResult = { success: boolean; error?: string };

const baseStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
    direction: rtl; text-align: right; color: #172033;
    font-size: 13px; margin: 0; padding: 0;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            padding-bottom: 12px; border-bottom: 2px solid #10a88a; margin-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #087f68; letter-spacing: 0.5px; }
  .doc-title { font-size: 18px; font-weight: 700; }
  .meta { font-size: 11px; color: #526078; margin-top: 3px; }
  .info-grid { display: flex; gap: 12px; margin-bottom: 14px; }
  .info-cell { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0;
               border-radius: 8px; padding: 10px; }
  .info-label { font-size: 10px; color: #758298; margin-bottom: 3px; }
  .info-value { font-size: 13px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #0b1220; color: #fff; padding: 9px 8px; font-size: 12px; text-align: right; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
  .totals-box { width: 60%; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0;
               border-bottom: 1px dashed #e2e8f0; font-size: 12px; }
  .total-row.grand { border-top: 2px solid #10a88a; border-bottom: none;
                     font-size: 16px; font-weight: 800; color: #087f68;
                     padding-top: 10px; margin-top: 4px; }
  .notes { margin-top: 18px; padding: 10px; background: #f8fafc;
           border-radius: 6px; font-size: 12px; color: #526078; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between;
               font-size: 11px; color: #526078; }
  .signature .line { border-top: 1px solid #94a3b8; padding-top: 4px;
                     width: 180px; text-align: center; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0;
            font-size: 10px; color: #94a3b8; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px;
           font-size: 11px; font-weight: 700; }
  .badge-cash { background: #e8f7f3; color: #087f68; }
  .badge-credit { background: #fef3c7; color: #92400e; }
`;

export async function printHtml(html: string): Promise<PrintResult> {
  try {
    await Print.printAsync({ html });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

export async function shareHtmlAsPdf(
  html: string,
  fileName: string
): Promise<PrintResult> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const can = await Sharing.isAvailableAsync();
    if (!can) return { success: false, error: "المشاركة غير متوفرة" };
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: fileName,
      UTI: "com.adobe.pdf",
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

// ============ فاتورة ============

export type InvoicePrintLine = {
  itemName: string;
  itemSku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

export type InvoicePrintData = {
  type: "sales" | "purchase";
  invoiceNo: string;
  createdAt: number;
  partyLabel: string;
  partyName: string;
  partyPhone?: string;
  currencyCode: string;
  currencySymbol: string;
  exchangeRate: number;
  isBase: boolean;
  paymentType: "cash" | "credit";
  cashboxName?: string;
  lines: InvoicePrintLine[];
  total: number;
  notes?: string;
};

export function buildInvoiceHtml(data: InvoicePrintData): string {
  const docTitle =
    data.type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات";
  const dateStr = new Date(data.createdAt).toLocaleString("ar-EG");
  const paymentLabel = data.paymentType === "cash" ? "نقدي" : "أجل";
  const paymentClass =
    data.paymentType === "cash" ? "badge-cash" : "badge-credit";
  const symbol = data.currencySymbol || data.currencyCode;

  const linesHtml = data.lines
    .map(
      (l, i) => `
      <tr>
        <td style="width:35px; text-align:center;">${i + 1}</td>
        <td>${l.itemName}
          <div style="font-size:10px; color:#758298; margin-top:2px;">${l.itemSku}</div>
        </td>
        <td style="width:90px; text-align:center;">${l.quantity} ${l.unit}</td>
        <td style="width:90px;">${l.unitPrice.toFixed(2)}</td>
        <td style="width:110px; font-weight:700;">${(l.quantity * l.unitPrice).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const baseEquivalent =
    !data.isBase && data.exchangeRate && data.exchangeRate !== 1
      ? `<div class="total-row" style="font-size:11px; color:#758298;">
           <span>ما يعادل</span>
           <span>${(data.total * data.exchangeRate).toFixed(2)}</span>
         </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${docTitle} - ${data.invoiceNo}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">فلوكس</div>
      <div class="meta">منتج تسليك المجاري</div>
    </div>
    <div style="text-align:left;">
      <div class="doc-title">${docTitle}</div>
      <div class="meta">رقم: <strong>${data.invoiceNo}</strong></div>
      <div class="meta">التاريخ: ${dateStr}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">${data.partyLabel}</div>
      <div class="info-value">${data.partyName}</div>
      ${data.partyPhone ? `<div class="meta">${data.partyPhone}</div>` : ""}
    </div>
    <div class="info-cell">
      <div class="info-label">تفاصيل الدفع</div>
      <div class="info-value">
        <span class="badge ${paymentClass}">${paymentLabel}</span>
      </div>
      ${data.cashboxName ? `<div class="meta">${data.cashboxName}</div>` : ""}
      <div class="meta">العملة: ${symbol}</div>
    </div>
  </div>

  <h2>الأصناف (${data.lines.length})</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:center;">#</th>
        <th>الصنف</th>
        <th style="text-align:center;">الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row">
        <span>عدد الأصناف</span>
        <span>${data.lines.length}</span>
      </div>
      ${baseEquivalent}
      <div class="total-row grand">
        <span>الإجمالي</span>
        <span>${data.total.toFixed(2)} ${symbol}</span>
      </div>
    </div>
  </div>

  ${data.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${data.notes}</div>` : ""}

  <div class="signature">
    <div class="line">توقيع المستلم</div>
    <div class="line">توقيع البائع</div>
  </div>

  <div class="footer">نظام فلوكس المحاسبي — ${data.invoiceNo}</div>
</body>
</html>`;
}

// ============ سند ============

export type VoucherPrintData = {
  voucherNo: string;
  voucherType: "receipt" | "payment";
  createdAt: number;
  partyName: string;
  cashboxName: string;
  amount: number;
  currencySymbol: string;
  description?: string;
};

export function buildVoucherHtml(data: VoucherPrintData): string {
  const title = data.voucherType === "receipt" ? "سند قبض" : "سند دفع";
  const dateStr = new Date(data.createdAt).toLocaleString("ar-EG");
  const badgeClass =
    data.voucherType === "receipt" ? "badge-cash" : "badge-credit";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><title>${title}</title><style>${baseStyles}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">فلوكس</div>
      <div class="meta">منتج تسليك المجاري</div>
    </div>
    <div style="text-align:left;">
      <div class="doc-title">${title}</div>
      <div class="meta">رقم: <strong>${data.voucherNo}</strong></div>
      <div class="meta">التاريخ: ${dateStr}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">الطرف</div>
      <div class="info-value">${data.partyName}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">الصندوق</div>
      <div class="info-value">${data.cashboxName}</div>
    </div>
  </div>

  <div style="margin-top:24px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0;
              border-radius:10px; text-align:center;">
    <div class="info-label" style="font-size:12px;">المبلغ</div>
    <div style="font-size:32px; font-weight:800; color:#087f68; margin-top:6px;">
      ${data.amount.toFixed(2)} ${data.currencySymbol}
    </div>
    <div style="margin-top:8px;">
      <span class="badge ${badgeClass}">${title}</span>
    </div>
  </div>

  ${data.description ? `<div class="notes"><strong>البيان:</strong> ${data.description}</div>` : ""}

  <div class="signature">
    <div class="line">توقيع المستلم</div>
    <div class="line">توقيع المسؤول</div>
  </div>

  <div class="footer">نظام فلوكس المحاسبي — ${data.voucherNo}</div>
</body>
</html>`;
}
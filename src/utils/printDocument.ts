import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export type PrintResult = { success: boolean; error?: string };

const baseStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
    direction: rtl; text-align: right; color: #0F172A;
    font-size: 15px; margin: 0; padding: 0; line-height: 1.6;
  }
  h1 { font-size: 28px; margin: 0 0 6px; color: #1E40AF; }
  h2 { font-size: 19px; margin: 22px 0 10px; border-bottom: 2px solid #D6E3F8;
       padding-bottom: 6px; color: #1E40AF; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            padding-bottom: 16px; border-bottom: 3px solid #F97316; margin-bottom: 20px; }
  .brand { font-size: 26px; font-weight: 800; color: #1E40AF; letter-spacing: 0.5px; }
  .brand-sub { font-size: 12px; color: #8494B0; font-weight: 700; margin-top: 2px; }
  .doc-title { font-size: 20px; font-weight: 700; color: #0F172A; }
  .meta { font-size: 13px; color: #64748B; margin-top: 4px; }
  .info-grid { display: flex; gap: 14px; margin-bottom: 18px; }
  .info-cell { flex: 1; background: #EFF6FF; border: 1.5px solid #D6E3F8;
               border-radius: 10px; padding: 14px; }
  .info-label { font-size: 12px; color: #8494B0; margin-bottom: 5px; font-weight: 700; }
  .info-value { font-size: 16px; font-weight: 800; color: #0F172A; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #0B2545; color: #FFFFFF; padding: 12px 10px; font-size: 14px;
       text-align: right; font-weight: 700; }
  td { padding: 11px 10px; border-bottom: 1.5px solid #E2E8F0; font-size: 14px;
       text-align: right; color: #0F172A; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
  .totals-box { width: 65%; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0;
               border-bottom: 1.5px dashed #D6E3F8; font-size: 14px; color: #0F172A; }
  .total-row.grand { border-top: 3px solid #F97316; border-bottom: none;
                     font-size: 20px; font-weight: 800; color: #F97316;
                     padding-top: 14px; margin-top: 6px; }
  .notes { margin-top: 22px; padding: 14px; background: #EFF6FF;
           border-left: 5px solid #1E40AF; border-radius: 8px;
           font-size: 14px; color: #0F172A; }
  .signature { margin-top: 50px; display: flex; justify-content: space-between;
               font-size: 13px; color: #64748B; }
  .signature .line { border-top: 1.5px solid #8494B0; padding-top: 6px;
                     width: 200px; text-align: center; font-weight: 600; }
  .footer { margin-top: 35px; padding-top: 12px; border-top: 1.5px solid #D6E3F8;
            font-size: 12px; color: #8494B0; text-align: center; font-weight: 600; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 6px;
           font-size: 13px; font-weight: 800; }
  .badge-cash { background: #DCFCE7; color: #059669; }
  .badge-credit { background: #FEF3C7; color: #D97706; }
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
        <td style="width:40px; text-align:center;">${i + 1}</td>
        <td>${l.itemName}
          <div style="font-size:12px; color:#8494B0; margin-top:3px;">${l.itemSku}</div>
        </td>
        <td style="width:110px; text-align:center;">${l.quantity} ${l.unit}</td>
        <td style="width:110px;">${l.unitPrice.toFixed(2)}</td>
        <td style="width:130px; font-weight:800; color:#1E40AF;">${(l.quantity * l.unitPrice).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const baseEquivalent =
    !data.isBase && data.exchangeRate && data.exchangeRate !== 1
      ? `<div class="total-row" style="font-size:13px; color:#8494B0;">
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
      <div class="brand-sub">مسلك مجاري</div>
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
      <div class="brand-sub">مسلك مجاري</div>
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

  <div style="margin-top:30px; padding:26px; background:#EFF6FF; border:2px solid #D6E3F8;
              border-radius:12px; text-align:center;">
    <div class="info-label" style="font-size:14px;">المبلغ</div>
    <div style="font-size:38px; font-weight:800; color:#F97316; margin-top:10px;">
      ${data.amount.toFixed(2)} ${data.currencySymbol}
    </div>
    <div style="margin-top:12px;">
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

export type JournalPrintData = {
  entryNo: string;
  createdAt: number;
  description: string;
  totalDebit: number;
  totalCredit: number;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
};

export function buildJournalHtml(data: JournalPrintData): string {
  const dateStr = new Date(data.createdAt).toLocaleString("ar-EG");
  const rows = data.lines
    .map(
      (l) => `
      <tr>
        <td style="font-family:monospace; font-weight:700;">${l.accountCode}</td>
        <td>${l.accountName}</td>
        <td style="width:110px; font-weight:700;">${l.debit > 0 ? l.debit.toFixed(2) : "-"}</td>
        <td style="width:110px; font-weight:700;">${l.credit > 0 ? l.credit.toFixed(2) : "-"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><title>قيد ${data.entryNo}</title><style>${baseStyles}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">فلوكس</div>
      <div class="brand-sub">مسلك مجاري</div>
    </div>
    <div style="text-align:left;">
      <div class="doc-title">قيد يومية</div>
      <div class="meta">رقم: <strong>${data.entryNo}</strong></div>
      <div class="meta">التاريخ: ${dateStr}</div>
    </div>
  </div>

  <div class="notes" style="margin-bottom:18px;">
    <strong>البيان:</strong> ${data.description}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:110px;">رمز الحساب</th>
        <th>اسم الحساب</th>
        <th>مدين</th>
        <th>دائن</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#EFF6FF; font-weight:800; color:#1E40AF;">
        <td colspan="2" style="text-align:right; font-size:16px;">الإجمالي</td>
        <td style="font-size:16px;">${data.totalDebit.toFixed(2)}</td>
        <td style="font-size:16px;">${data.totalCredit.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">نظام فلوكس المحاسبي — ${data.entryNo}</div>
</body>
</html>`;
}

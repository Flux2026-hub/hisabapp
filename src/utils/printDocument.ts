import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getSettings } from "./getSettings";
import { getLogoBase64 } from "./logoBase64";

export type PrintResult = { success: boolean; error?: string };

function baseStyles() {
  return `
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
  .company-info { font-size: 12px; color: #64748B; margin-top: 4px; line-height: 1.5; }
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
}

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
async function buildHeaderBlock(docTitle: string, docNumber: string, dateStr: string) {
  const s = await getSettings();
  const logo = s.showLogo ? await getLogoBase64() : null;

  const contactLines: string[] = [];
  const phones = [s.companyPhone1, s.companyPhone2].filter(Boolean).join(" / ");
  if (phones) contactLines.push("📞 " + phones);
  if (s.companyAddress) contactLines.push("📍 " + s.companyAddress);
  if (s.companyEmail) contactLines.push("✉️ " + s.companyEmail);
  if (s.companyWebsite) contactLines.push("🌐 " + s.companyWebsite);
  if (s.taxNumber) contactLines.push("الرقم الضريبي: " + s.taxNumber);
  if (s.commercialRegister) contactLines.push("السجل التجاري: " + s.commercialRegister);

  const contactHtml = contactLines.length
    ? `<div style="font-size:12px; color:#64748B; margin-top:10px; line-height:1.9; text-align:center;">${contactLines.join(" &nbsp;•&nbsp; ")}</div>`
    : "";

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:80px; object-fit:contain; display:block; margin:0 auto 12px;" />`
    : "";

  return `
    <div style="text-align:center; padding-bottom:16px; border-bottom:3px solid #F97316; margin-bottom:18px;">
      ${logoHtml}
      <div style="font-size:24px; font-weight:800; color:#1E40AF;">${s.companyNameAr || "فلوكس"}</div>
      <div style="font-size:13px; font-weight:700; color:#8494B0; margin-top:2px;">${s.companyNameEn || "Flux"}</div>
      ${contactHtml}
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1.5px solid #D6E3F8;">
      <div style="font-size:18px; font-weight:800; color:#0F172A;">${docTitle}</div>
      <div style="text-align:left;">
        <div style="font-size:13px; color:#64748B;">رقم: <strong style="color:#0F172A;">${docNumber}</strong></div>
        <div style="font-size:13px; color:#64748B;">التاريخ: ${dateStr}</div>
      </div>
    </div>
  `;
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

export async function buildInvoiceHtml(data: InvoicePrintData): Promise<string> {
  const s = await getSettings();
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

  const signaturesHtml = s.showSignatures
    ? `<div class="signature">
         <div class="line">${s.signatureRight || "توقيع المستلم"}</div>
         <div class="line">${s.signatureLeft || "توقيع البائع"}</div>
       </div>`
    : "";

  const headerBlock = await buildHeaderBlock(
    s.invoiceHeaderTitle
      ? `${s.invoiceHeaderTitle} - ${docTitle}`
      : docTitle,
    data.invoiceNo,
    dateStr
  );

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${docTitle} - ${data.invoiceNo}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${headerBlock}

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

  ${signaturesHtml}

  <div class="footer">${s.invoiceFooterText || s.companyNameAr}</div>
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

export async function buildVoucherHtml(data: VoucherPrintData): Promise<string> {
  const s = await getSettings();
  const title = data.voucherType === "receipt" ? "سند قبض" : "سند دفع";
  const dateStr = new Date(data.createdAt).toLocaleString("ar-EG");
  const badgeClass =
    data.voucherType === "receipt" ? "badge-cash" : "badge-credit";

  const signaturesHtml = s.showSignatures
    ? `<div class="signature">
         <div class="line">${s.signatureRight || "توقيع المستلم"}</div>
         <div class="line">${s.signatureLeft || "توقيع المسؤول"}</div>
       </div>`
    : "";

  const headerBlock = await buildHeaderBlock(title, data.voucherNo, dateStr);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><title>${title}</title><style>${baseStyles()}</style></head>
<body>
  ${headerBlock}

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

  ${signaturesHtml}

  <div class="footer">${s.invoiceFooterText || s.companyNameAr}</div>
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

export async function buildJournalHtml(data: JournalPrintData): Promise<string> {
  const s = await getSettings();
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

  const headerBlock = await buildHeaderBlock("قيد يومية", data.entryNo, dateStr);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><title>قيد ${data.entryNo}</title><style>${baseStyles()}</style></head>
<body>
  ${headerBlock}

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

  <div class="footer">${s.invoiceFooterText || s.companyNameAr}</div>
</body>
</html>`;
}

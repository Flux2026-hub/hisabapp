import { sqlite } from "../db/local";

type PostingLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

type Source = {
  sourceType: string;
  sourceId: string;
  description: string;
  createdAt?: number;
};

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function replaceJournalPosting(source: Source, lines: PostingLine[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (!lines.length || Math.abs(debit - credit) > 0.001) {
    throw new Error("لا يمكن ترحيل قيد غير متوازن");
  }

  const oldEntries: any[] = await sqlite.getAllAsync(
    "SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?",
    [source.sourceType, source.sourceId]
  );
  for (const entry of oldEntries) {
    await sqlite.runAsync("DELETE FROM journal_lines WHERE entry_id = ?", [entry.id]);
    await sqlite.runAsync("DELETE FROM journal_entries WHERE id = ?", [entry.id]);
  }

  const entryId = id();
  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = source.createdAt || Date.now();
  await sqlite.runAsync(
    `INSERT INTO journal_entries
      (id, entry_no, description, total_debit, total_credit, created_at, source_type, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entryId, entryNo, source.description, debit, credit, createdAt, source.sourceType, source.sourceId]
  );

  for (const line of lines) {
    await sqlite.runAsync(
      `INSERT INTO journal_lines
        (id, entry_id, account_code, account_name, debit, credit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id(), entryId, line.accountCode, line.accountName, Number(line.debit || 0), Number(line.credit || 0)]
    );
  }

  return { entryId, entryNo };
}

export async function removeJournalPosting(sourceType: string, sourceId: string) {
  const oldEntries: any[] = await sqlite.getAllAsync(
    "SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?",
    [sourceType, sourceId]
  );
  for (const entry of oldEntries) {
    await sqlite.runAsync("DELETE FROM journal_lines WHERE entry_id = ?", [entry.id]);
    await sqlite.runAsync("DELETE FROM journal_entries WHERE id = ?", [entry.id]);
  }
}

async function getDefaultMapping() {
  return await sqlite.getFirstAsync<any>("SELECT * FROM default_accounts WHERE id = 'default'");
}

async function getAccount(code: string | null | undefined) {
  if (!code) return null;
  return await sqlite.getFirstAsync<any>("SELECT code, name FROM accounts WHERE code = ?", [code]);
}

function requirePostingAccount(account: any, message: string) {
  if (!account) throw new Error(message);
  return account;
}

async function resolvePartyAccount(partyType: "customer" | "supplier", partyId: string | null | undefined, fallbackCode: string | null | undefined) {
  if (partyId) {
    const table = partyType === "customer" ? "customers" : "suppliers";
    const party: any = await sqlite.getFirstAsync(`SELECT account_code FROM ${table} WHERE id = ?`, [partyId]);
    if (party?.account_code) return await getAccount(party.account_code);
  }
  return await getAccount(fallbackCode);
}

export async function postSalesInvoice(sourceId: string, customerId: string | null, cashboxId: string | null, totalBase: number, createdAt: number, cogsTotal = 0) {
  const defaults: any = await getDefaultMapping();
  const revenue = await getAccount(defaults?.sales_revenue_account);
  const debitAccount = cashboxId
    ? await sqlite.getFirstAsync<any>("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [cashboxId])
    : await resolvePartyAccount("customer", customerId, defaults?.customer_account);
  if (totalBase <= 0) throw new Error("قيمة فاتورة المبيعات يجب أن تكون أكبر من صفر");
  requirePostingAccount(revenue, "الحساب الافتراضي لإيرادات المبيعات غير مضبوط");
  requirePostingAccount(debitAccount, cashboxId ? "الصندوق غير مرتبط بحساب محاسبي" : "حساب العميل غير موجود");
  const lines: PostingLine[] = [
      { accountCode: debitAccount.code, accountName: debitAccount.name, debit: totalBase, credit: 0 },
      { accountCode: revenue.code, accountName: revenue.name, debit: 0, credit: totalBase },
    ];
  if (cogsTotal > 0) {
    const cogs = requirePostingAccount(await getAccount(defaults?.cogs_account), "الحساب الافتراضي لتكلفة المبيعات غير مضبوط");
    const inventory = requirePostingAccount(await getAccount(defaults?.inventory_account), "الحساب الافتراضي للمخزون غير مضبوط");
    lines.push({ accountCode: cogs.code, accountName: cogs.name, debit: cogsTotal, credit: 0 });
    lines.push({ accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: cogsTotal });
  }
  return replaceJournalPosting(
    { sourceType: "sales_invoice", sourceId, description: "قيد فاتورة مبيعات", createdAt },
    lines
  );
}

export async function postPurchaseInvoice(sourceId: string, supplierId: string | null, cashboxId: string | null, totalBase: number, createdAt: number) {
  const defaults: any = await getDefaultMapping();
  const creditAccount = cashboxId
    ? await sqlite.getFirstAsync<any>("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [cashboxId])
    : await resolvePartyAccount("supplier", supplierId, defaults?.supplier_account);
  const debit = await getAccount(defaults?.purchase_account || defaults?.inventory_account);
  if (totalBase <= 0) throw new Error("قيمة فاتورة المشتريات يجب أن تكون أكبر من صفر");
  requirePostingAccount(debit, "الحساب الافتراضي للمشتريات أو المخزون غير مضبوط");
  requirePostingAccount(creditAccount, cashboxId ? "الصندوق غير مرتبط بحساب محاسبي" : "حساب المورد غير موجود");
  return replaceJournalPosting(
    { sourceType: "purchase_invoice", sourceId, description: "قيد فاتورة مشتريات", createdAt },
    [{ accountCode: debit.code, accountName: debit.name, debit: totalBase, credit: 0 }, { accountCode: creditAccount.code, accountName: creditAccount.name, debit: 0, credit: totalBase }]
  );
}

export async function postVoucher(sourceId: string, voucherType: "receipt" | "payment", partyType: "customer" | "supplier" | "account" | "none", partyId: string | null, cashboxId: string, amountBase: number, createdAt: number) {
  if (partyType === "none" || amountBase <= 0) return null;
  const cashAccount: any = await sqlite.getFirstAsync("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [cashboxId]);
  let partyAccount: any = null;
  if (partyType === "account") partyAccount = await getAccount(partyId);
  else partyAccount = await resolvePartyAccount(partyType, partyId, partyType === "customer" ? undefined : undefined);
  requirePostingAccount(cashAccount, "الصندوق غير مرتبط بحساب محاسبي");
  requirePostingAccount(partyAccount, "الحساب المقابل للسند غير موجود");
  const lines = voucherType === "receipt"
    ? [{ accountCode: cashAccount.code, accountName: cashAccount.name, debit: amountBase, credit: 0 }, { accountCode: partyAccount.code, accountName: partyAccount.name, debit: 0, credit: amountBase }]
    : [{ accountCode: partyAccount.code, accountName: partyAccount.name, debit: amountBase, credit: 0 }, { accountCode: cashAccount.code, accountName: cashAccount.name, debit: 0, credit: amountBase }];
  return replaceJournalPosting({ sourceType: "voucher", sourceId, description: voucherType === "receipt" ? "قيد سند قبض" : "قيد سند دفع", createdAt }, lines);
}

export async function postSalesReturn(sourceId: string, customerId: string | null, cashboxId: string | null, totalBase: number, createdAt: number, returnedCostBase = 0) {
  const defaults: any = await getDefaultMapping();
  const returnAccount = await getAccount(defaults?.sales_return_account || defaults?.sales_revenue_account);
  const creditAccount = cashboxId
    ? await sqlite.getFirstAsync<any>("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [cashboxId])
    : await resolvePartyAccount("customer", customerId, defaults?.customer_account);
  if (totalBase <= 0) throw new Error("قيمة مرتجع المبيعات يجب أن تكون أكبر من صفر");
  requirePostingAccount(returnAccount, "الحساب الافتراضي لمردودات المبيعات غير مضبوط");
  requirePostingAccount(creditAccount, cashboxId ? "الصندوق غير مرتبط بحساب محاسبي" : "حساب العميل غير موجود");
  const lines: PostingLine[] = [
      { accountCode: returnAccount.code, accountName: returnAccount.name, debit: totalBase, credit: 0 },
      { accountCode: creditAccount.code, accountName: creditAccount.name, debit: 0, credit: totalBase },
    ];
  if (returnedCostBase > 0) {
    const cogs = requirePostingAccount(await getAccount(defaults?.cogs_account), "الحساب الافتراضي لتكلفة المبيعات غير مضبوط");
    const inventory = requirePostingAccount(await getAccount(defaults?.inventory_account), "الحساب الافتراضي للمخزون غير مضبوط");
    lines.push({ accountCode: inventory.code, accountName: inventory.name, debit: returnedCostBase, credit: 0 });
    lines.push({ accountCode: cogs.code, accountName: cogs.name, debit: 0, credit: returnedCostBase });
  }
  return replaceJournalPosting(
    { sourceType: "sales_return", sourceId, description: "قيد مرتجع مبيعات", createdAt },
    lines
  );
}

export async function postPurchaseReturn(sourceId: string, supplierId: string | null, cashboxId: string | null, totalBase: number, createdAt: number) {
  const defaults: any = await getDefaultMapping();
  const debitAccount = cashboxId
    ? await sqlite.getFirstAsync<any>("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [cashboxId])
    : await resolvePartyAccount("supplier", supplierId, defaults?.supplier_account);
  const returnAccount = await getAccount(defaults?.purchase_return_account || defaults?.purchase_account || defaults?.inventory_account);
  if (totalBase <= 0) throw new Error("قيمة مرتجع المشتريات يجب أن تكون أكبر من صفر");
  requirePostingAccount(debitAccount, cashboxId ? "الصندوق غير مرتبط بحساب محاسبي" : "حساب المورد غير موجود");
  requirePostingAccount(returnAccount, "الحساب الافتراضي لمردودات المشتريات غير مضبوط");
  return replaceJournalPosting(
    { sourceType: "purchase_return", sourceId, description: "قيد مرتجع مشتريات", createdAt },
    [{ accountCode: debitAccount.code, accountName: debitAccount.name, debit: totalBase, credit: 0 }, { accountCode: returnAccount.code, accountName: returnAccount.name, debit: 0, credit: totalBase }]
  );
}

async function getCurrencyBaseRate(code: string | null | undefined) {
  if (!code) return 1;
  const currency: any = await sqlite.getFirstAsync("SELECT is_base, exchange_rate FROM currencies WHERE code = ?", [code]);
  return currency?.is_base ? 1 : Number(currency?.exchange_rate) || 1;
}

export async function postCashboxTransfer(
  sourceId: string,
  fromCashboxId: string,
  toCashboxId: string,
  sourceAmount: number,
  targetAmount: number,
  fromCurrency: string,
  toCurrency: string,
  createdAt: number,
) {
  if (sourceAmount <= 0 || targetAmount <= 0) throw new Error("قيمة التحويل يجب أن تكون أكبر من صفر");
  const fromAccount: any = await sqlite.getFirstAsync("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [fromCashboxId]);
  const toAccount: any = await sqlite.getFirstAsync("SELECT a.code, a.name FROM cashboxes c JOIN accounts a ON a.code = c.account_code WHERE c.id = ?", [toCashboxId]);
  requirePostingAccount(fromAccount, "الصندوق المصدر غير مرتبط بحساب محاسبي");
  requirePostingAccount(toAccount, "الصندوق الهدف غير مرتبط بحساب محاسبي");

  const sourceBase = sourceAmount * await getCurrencyBaseRate(fromCurrency);
  const targetBase = targetAmount * await getCurrencyBaseRate(toCurrency);
  const difference = targetBase - sourceBase;
  const lines: PostingLine[] = [
    { accountCode: toAccount.code, accountName: toAccount.name, debit: targetBase, credit: 0 },
    { accountCode: fromAccount.code, accountName: fromAccount.name, debit: 0, credit: sourceBase },
  ];

  if (Math.abs(difference) > 0.001) {
    const differenceAccount = await getAccount(difference > 0 ? "4201" : "5201");
    requirePostingAccount(differenceAccount, "حساب فروق العملة غير موجود في دليل الحسابات");
    if (difference > 0) lines.push({ accountCode: differenceAccount.code, accountName: differenceAccount.name, debit: 0, credit: difference });
    else lines.push({ accountCode: differenceAccount.code, accountName: differenceAccount.name, debit: -difference, credit: 0 });
  }

  return replaceJournalPosting(
    { sourceType: "cashbox_transfer", sourceId, description: "قيد تحويل بين الصناديق", createdAt },
    lines,
  );
}

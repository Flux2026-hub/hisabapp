import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { sqlite } from "../db/local";

type Kind = "suppliers" | "cashboxes" | "cashboxMovements" | "openingBalances";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function ReportsModule({
  kind,
  onBack,
}: {
  kind: Kind;
  onBack?: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-12-31");
  const [baseCurrency, setBaseCurrency] = useState<{
    code: string;
    symbol: string;
    name: string;
  }>({ code: "YER", symbol: "ر.ي", name: "ريال يمني" });

  const isOpening = kind === "openingBalances";
  const isMovements = kind === "cashboxMovements";

  const load = async () => {
    try {
      const base: any = await sqlite.getFirstAsync(
        "SELECT code, name, symbol FROM currencies WHERE is_base = 1 LIMIT 1"
      );
      if (base) {
        setBaseCurrency({
          code: base.code,
          symbol: base.symbol || base.code,
          name: base.name,
        });
      }

      if (kind === "suppliers") {
        const s: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM suppliers ORDER BY name"
        );
        setRows(s || []);
      } else if (kind === "cashboxes") {
        const c: any = await sqlite.getAllAsync(
          "SELECT id, code, name, cashbox_type, balance FROM cashboxes ORDER BY name"
        );
        setRows(c || []);
      } else if (isMovements) {
        const fromTs = new Date(from + "T00:00:00").getTime() || 0;
        const toTs = new Date(to + "T23:59:59").getTime() || Date.now();
        const movements: any = await sqlite.getAllAsync(
          `SELECT id, cashbox_id, voucher_type, voucher_no as reference,
                  party_name as party, description, amount, created_at
           FROM vouchers
           WHERE created_at >= ? AND created_at <= ?
           ORDER BY created_at DESC`,
          [fromTs, toTs]
        );
        const mapped = (movements || []).map((m: any) => ({
          id: m.id,
          date: m.created_at,
          type: m.voucher_type === "receipt" ? "قبض" : "دفع",
          reference: m.reference,
          cashboxId: m.cashbox_id,
          party: m.party,
          description: m.description,
          debit: m.voucher_type === "receipt" ? Number(m.amount) : 0,
          credit: m.voucher_type === "payment" ? Number(m.amount) : 0,
          amount: Number(m.amount),
        }));
        setRows(mapped);
      } else if (isOpening) {
        const acc: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance, account_type FROM accounts ORDER BY code"
        );
        const items: any = await sqlite.getAllAsync(
          "SELECT id, sku, name, stock_quantity, average_cost FROM items ORDER BY name"
        );
        setRows([
          ...(acc || []).map((a: any) => ({ ...a, rowType: "account" })),
          ...(items || []).map((i: any) => ({ ...i, rowType: "item" })),
        ]);
      }
    } catch (e) {
      Alert.alert("تعذر تحميل التقرير", String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const title =
    kind === "suppliers"
      ? "تقرير الموردين التفصيلي"
      : kind === "cashboxes"
      ? "أرصدة الصناديق"
      : isMovements
      ? "حركة الصناديق التفصيلية"
      : "الأرصدة الافتتاحية";

  const total = rows.reduce((n, r) => n + Number(r.balance || 0), 0);
  const movementDebit = rows.reduce((n, r) => n + Number(r.debit || 0), 0);
  const movementCredit = rows.reduce((n, r) => n + Number(r.credit || 0), 0);

  const buildHtml = () => {
    let body = "";

    if (kind === "suppliers" || kind === "cashboxes") {
      body = `<table><tr><th>الرمز</th><th>الاسم</th><th>التفاصيل</th><th>الرصيد</th></tr>${rows
        .map(
          (r) =>
            `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(
              r.phone || r.cashbox_type || ""
            )}</td><td>${Number(r.balance || 0).toFixed(2)} ${esc(baseCurrency.symbol)}</td></tr>`
        )
        .join("")}</table>`;
    } else if (isMovements) {
      body = `<table><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>الطرف</th><th>البيان</th><th>قبض</th><th>دفع</th></tr>${rows
        .map(
          (r) =>
            `<tr><td>${esc(new Date(r.date).toLocaleDateString("ar-EG"))}</td><td>${esc(
              r.type
            )}</td><td>${esc(r.reference)}</td><td>${esc(r.party)}</td><td>${esc(
              r.description
            )}</td><td>${Number(r.debit || 0).toFixed(2)}</td><td>${Number(r.credit || 0).toFixed(
              2
            )}</td></tr>`
        )
        .join("")}</table>`;
    } else {
      const accounts = rows.filter((r) => r.rowType === "account");
      const items = rows.filter((r) => r.rowType === "item");
      body = `<h2>أرصدة الحسابات</h2><table><tr><th>الرمز</th><th>الاسم</th><th>النوع</th><th>الرصيد</th></tr>${accounts
        .map(
          (r) =>
            `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(
              r.account_type
            )}</td><td>${Number(r.balance || 0).toFixed(2)}</td></tr>`
        )
        .join("")}</table><h2>أرصدة الأصناف</h2><table><tr><th>الرمز</th><th>الاسم</th><th>الكمية</th><th>التكلفة</th><th>القيمة</th></tr>${items
        .map(
          (r) =>
            `<tr><td>${esc(r.sku)}</td><td>${esc(r.name)}</td><td>${Number(
              r.stock_quantity || 0
            ).toFixed(2)}</td><td>${Number(r.average_cost || 0).toFixed(2)}</td><td>${(
              Number(r.stock_quantity || 0) * Number(r.average_cost || 0)
            ).toFixed(2)}</td></tr>`
        )
        .join("")}</table>`;
    }

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial,"Tahoma";padding:24px;color:#172033;direction:rtl}
      .header{text-align:center;border-bottom:2px solid #10a88a;padding-bottom:12px;margin-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#087f68}
      h2{font-size:16px;margin-top:16px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{border:1px solid #dfe5ed;padding:7px;text-align:right;font-size:11px}
      th{background:#e8f7f3;font-weight:700}
      .meta{text-align:right;color:#526078;font-size:11px;margin:8px 0}
      .footer{margin-top:20px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#758298;text-align:center}
    </style></head><body>
      <div class="header">
        <div class="brand">فلوكس</div>
        <div style="font-size:12px;color:#758298">منتج تسليك المجاري</div>
      </div>
      <h1 style="text-align:right;font-size:18px">${esc(title)}</h1>
      <div class="meta">الفترة: ${esc(from)} إلى ${esc(to)} | العملة الأساسية: ${esc(baseCurrency.name)} (${esc(baseCurrency.symbol)})</div>
      ${body}
      <div class="footer">نظام فلوكس المحاسبي</div>
    </body></html>`;
  };

  const exportPdf = async () => {
    try {
      const result = await Print.printToFileAsync({ html: buildHtml() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: `تصدير ${title} إلى PDF`,
        });
      }
    } catch (e) {
      Alert.alert("تعذر تصدير PDF", String(e));
    }
  };

  return (
    <View>
      {onBack && (
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
        </Pressable>
      )}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>
        تقرير محلي — العملة الأساسية: {baseCurrency.name} ({baseCurrency.symbol})
      </Text>

      <Text style={styles.label}>من تاريخ</Text>
      <TextInput style={styles.input} value={from} onChangeText={setFrom} textAlign="right" />

      <Text style={styles.label}>إلى تاريخ</Text>
      <TextInput style={styles.input} value={to} onChangeText={setTo} textAlign="right" />

      <View style={styles.summary}>
        {isMovements ? (
          <>
            <Text style={styles.summaryText}>عدد الحركات: {rows.length}</Text>
            <Text style={styles.summaryText}>
              إجمالي القبض: {movementDebit.toFixed(2)} {baseCurrency.symbol}
            </Text>
            <Text style={styles.summaryText}>
              إجمالي الصرف: {movementCredit.toFixed(2)} {baseCurrency.symbol}
            </Text>
            <Text style={styles.summaryText}>
              الصافي: {(movementDebit - movementCredit).toFixed(2)} {baseCurrency.symbol}
            </Text>
          </>
        ) : isOpening ? (
          <Text style={styles.summaryText}>عدد السجلات: {rows.length}</Text>
        ) : (
          <>
            <Text style={styles.summaryText}>عدد السجلات: {rows.length}</Text>
            <Text style={styles.summaryText}>
              إجمالي الرصيد: {total.toFixed(2)} {baseCurrency.symbol}
            </Text>
          </>
        )}
      </View>

      {kind === "suppliers" || kind === "cashboxes" ? (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.value}>
              {Number(r.balance || 0).toFixed(2)} {baseCurrency.symbol}
            </Text>
            <View>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.small}>
                {r.code} · {r.phone || r.cashbox_type || ""}
              </Text>
            </View>
          </View>
        ))
      ) : isMovements ? (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.value}>{Number(r.amount || 0).toFixed(2)}</Text>
            <View>
              <Text style={styles.name}>
                {r.type} · {r.reference}
              </Text>
              <Text style={styles.small}>
                {new Date(r.date).toLocaleDateString("ar-EG")} · {r.party}
              </Text>
            </View>
          </View>
        ))
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.value}>
              {r.rowType === "account"
                ? Number(r.balance || 0).toFixed(2)
                : Number((r.stock_quantity || 0) * (r.average_cost || 0)).toFixed(2)}
            </Text>
            <View>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.small}>
                {r.rowType === "account" ? r.code : r.sku}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => load()}>
          <Text style={styles.buttonText}>تحديث التقرير</Text>
        </Pressable>
        <Pressable style={styles.pdfButton} onPress={exportPdf}>
          <Text style={styles.buttonText}>تصدير PDF</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", textAlign: "right", color: "#172033", marginBottom: 6 },
  hint: { fontSize: 12, color: "#758298", textAlign: "right", marginBottom: 12 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    color: "#172033",
  },
  summary: {
    backgroundColor: "#e8f7f3",
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
    gap: 4,
  },
  summaryText: { textAlign: "right", fontWeight: "700", color: "#087f68" },
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 12,
  },
  name: { fontWeight: "700", textAlign: "right", color: "#172033" },
  small: { fontSize: 11, color: "#758298", textAlign: "right", marginTop: 3 },
  value: { color: "#087f68", fontWeight: "700" },
  actions: { flexDirection: "row-reverse", gap: 8, marginTop: 14 },
  button: { backgroundColor: "#315b85", padding: 14, borderRadius: 10, flex: 1 },
  pdfButton: { backgroundColor: "#10a88a", padding: 14, borderRadius: 10, flex: 1 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700" },
  back: { padding: 10, marginBottom: 8 },
  backText: { color: "#087f68", textAlign: "right", fontWeight: "700" },
});
import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";

const today = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const firstOfLastMonth = () => {
  const d = new Date();
  const m = d.getMonth() - 1;
  const year = m < 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = m < 0 ? 11 : m;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
};

const lastOfLastMonth = () => {
  const d = new Date();
  const m = d.getMonth();
  const lastDay = new Date(d.getFullYear(), m, 0);
  const year = m === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = m === 0 ? 11 : m - 1;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(
    lastDay.getDate()
  ).padStart(2, "0")}`;
};

export default function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const quickSets: { label: string; from: string; to: string }[] = [
    { label: "اليوم", from: today(), to: today() },
    { label: "7 أيام", from: daysAgo(7), to: today() },
    { label: "هذا الشهر", from: firstOfMonth(), to: today() },
    { label: "الشهر الماضي", from: firstOfLastMonth(), to: lastOfLastMonth() },
  ];

  return (
    <View>
      <View style={styles.quickRow}>
        {quickSets.map((q) => {
          const isActive = from === q.from && to === q.to;
          return (
            <Pressable
              key={q.label}
              style={[styles.quickBtn, isActive && styles.quickActive]}
              onPress={() => {
                onFromChange(q.from);
                onToChange(q.to);
              }}
            >
              <Text
                style={[styles.quickText, isActive && styles.quickTextActive]}
              >
                {q.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>من تاريخ</Text>
          <TextInput
            style={styles.input}
            value={from}
            onChangeText={onFromChange}
            textAlign="right"
            placeholder="2026-01-01"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>إلى تاريخ</Text>
          <TextInput
            style={styles.input}
            value={to}
            onChangeText={onToChange}
            textAlign="right"
            placeholder="2026-12-31"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  quickBtn: {
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  quickText: { fontSize: 11, color: "#0F172A", fontWeight: "600" },
  quickTextActive: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  label: {
    fontSize: 12,
    color: "#526078",
    textAlign: "right",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    padding: 10,
    color: "#0F172A",
    fontSize: 13,
  },
});
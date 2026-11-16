import { useState } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../ThemeContext";

const today = () => new Date().toISOString().slice(0, 10);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const firstOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
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
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
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
  const { colors } = useTheme();
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  const quickSets: { label: string; from: string; to: string }[] = [
    { label: "اليوم", from: today(), to: today() },
    { label: "هذا الشهر", from: firstOfMonth(), to: today() },
    { label: "هذا العام", from: firstOfYear(), to: today() },
    { label: "الشهر الماضي", from: firstOfLastMonth(), to: lastOfLastMonth() },
  ];

  const handleDateChange = (event: any, selectedDate: Date | undefined, isFrom: boolean) => {
    if (Platform.OS === 'android') {
      if (isFrom) setShowFrom(false);
      else setShowTo(false);
    }
    
    if (event.type === 'set' && selectedDate) {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      if (isFrom) onFromChange(dateStr);
      else onToChange(dateStr);
    }
  };

  return (
    <View>
      <View style={styles.quickRow}>
        {quickSets.map((q) => {
          const isActive = from === q.from && to === q.to;
          return (
            <Pressable
              key={q.label}
              style={[
                styles.quickBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isActive && { backgroundColor: colors.blue, borderColor: colors.blue }
              ]}
              onPress={() => {
                onFromChange(q.from);
                onToChange(q.to);
              }}
            >
              <Text style={[styles.quickText, { color: colors.text }, isActive && { color: "#fff" }]}>
                {q.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textMuted }]}>من تاريخ</Text>
          <Pressable
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowFrom(true)}
          >
            <Text style={{ textAlign: "center", color: colors.text, fontSize: 14 }}>
              {from}
            </Text>
          </Pressable>
          {showFrom && (
            <DateTimePicker
              value={from ? new Date(from) : new Date()}
              mode="date"
              display="default"
              onChange={(e, d) => handleDateChange(e, d, true)}
            />
          )}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textMuted }]}>إلى تاريخ</Text>
          <Pressable
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowTo(true)}
          >
            <Text style={{ textAlign: "center", color: colors.text, fontSize: 14 }}>
              {to}
            </Text>
          </Pressable>
          {showTo && (
            <DateTimePicker
              value={to ? new Date(to) : new Date()}
              mode="date"
              display="default"
              onChange={(e, d) => handleDateChange(e, d, false)}
            />
          )}
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickText: { fontSize: 11, fontWeight: "600" },
  row: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  label: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: "right",
    width: "100%"
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
    height: 42,
    width: "100%",
  },
});

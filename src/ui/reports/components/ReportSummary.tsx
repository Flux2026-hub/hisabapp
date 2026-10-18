import { StyleSheet, Text, View } from "react-native";

type Item = { label: string; value: string; color?: string };

export default function ReportSummary({ items }: { items: Item[] }) {
  return (
    <View style={styles.box}>
      {items.map((it, i) => (
        <View key={i} style={styles.row}>
          <Text
            style={[
              styles.value,
              it.color ? { color: it.color } : undefined,
            ]}
          >
            {it.value}
          </Text>
          <Text style={styles.label}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#cce9e0",
  },
  label: {color: "#1E40AF", fontSize: 13, fontWeight: "600", textAlign: "right", writingDirection: "rtl", width: "100%"},
  value: { color: "#1E40AF", fontSize: 15, fontWeight: "800" },
});
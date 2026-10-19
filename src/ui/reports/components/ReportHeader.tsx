import { StyleSheet, Text, View } from "react-native";

export default function ReportHeader({
  title,
  subtitle,
  from,
  to,
  currencySymbol,
}: {
  title: string;
  subtitle?: string;
  from: string;
  to: string;
  currencySymbol: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>فلوكس</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSub}>منتج تسليك المجاري</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.period}>
        الفترة: {from} → {to} | العملة: {currencySymbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 14 },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  logo: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  brandSub: {
    color: "#8494B0",
    fontSize: 12,
    textAlign: "right",
  },
  divider: {
    height: 2,
    backgroundColor: "#F97316",
    marginVertical: 10,
    borderRadius: 1,
  },
  title: {fontSize: 20,
    
    color: "#0F172A",
    
   textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  subtitle: {fontSize: 12,
    color: "#526078",
    
    marginTop: 4,
   textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  period: {
    fontSize: 11,
    color: "#8494B0",
    textAlign: "right",
    marginTop: 6,
  },
});
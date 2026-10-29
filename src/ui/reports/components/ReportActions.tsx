import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

export async function exportCsv(csvContent: string, fileName: string) {
  try {
    const path = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(path, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const can = await Sharing.isAvailableAsync();
    if (!can) return Alert.alert("المشاركة غير متوفرة");
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: fileName,
    });
  } catch (e) {
    Alert.alert("تعذر التصدير", String(e));
  }
}

export async function exportPdf(html: string, fileName: string) {
  try {
    const result = await Print.printToFileAsync({ html });
    const can = await Sharing.isAvailableAsync();
    if (!can) return Alert.alert("المشاركة غير متوفرة");
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: fileName,
      UTI: "com.adobe.pdf",
    });
  } catch (e) {
    Alert.alert("تعذر التصدير", String(e));
  }
}

export default function ReportActions({
  onRefresh,
  onExportPdf,
  onExportCsv,
}: {
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.refresh} onPress={onRefresh}>
        <Text style={styles.btnText}>🔄 تحديث</Text>
      </Pressable>
      <Pressable style={styles.pdf} onPress={onExportPdf}>
        <Text style={styles.btnText}>📄 PDF</Text>
      </Pressable>
      <Pressable style={styles.csv} onPress={onExportCsv}>
        <Text style={styles.btnText}>📊 CSV</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row-reverse", gap: 8, marginVertical: 14 },
  refresh: {
    backgroundColor: "#1E40AF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  pdf: {
    backgroundColor: "#F97316",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  csv: {
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
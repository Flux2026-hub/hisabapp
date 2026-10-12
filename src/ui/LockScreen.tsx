import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "./theme";

const PIN_KEY = "flux_pin";
const SESSION_KEY = "flux_session";

export async function hasPin(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return !!pin;
}
export async function isSessionActive(): Promise<boolean> {
  const s = await AsyncStorage.getItem(SESSION_KEY);
  return s === "1";
}
export async function endSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
export async function setNewPin(pin: string) {
  await AsyncStorage.setItem(PIN_KEY, pin);
  await AsyncStorage.setItem(SESSION_KEY, "1");
}

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const exists = await hasPin();
      setSetupMode(!exists);
    })();
  }, []);

  const appendDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) setTimeout(() => handleComplete(next), 200);
  };

  const removeDigit = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleComplete = async (entered: string) => {
    if (setupMode) {
      if (!firstPin) {
        setFirstPin(entered);
        setPin("");
        setError("");
      } else {
        if (firstPin === entered) {
          await setNewPin(entered);
          setSetupMode(false);
          onUnlock();
        } else {
          setError("الرمزان غير متطابقين");
          setPin("");
          setFirstPin("");
        }
      }
    } else {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (saved === entered) {
        await AsyncStorage.setItem(SESSION_KEY, "1");
        onUnlock();
      } else {
        setError("رمز خاطئ");
        setPin("");
      }
    }
  };

  const clearAll = () => {
    Alert.alert("نسيت الرمز؟", "الحل الوحيد هو حذف التطبيق وإعادة تثبيته.\n\n⚠️ سيتم فقدان كل البيانات!", [
      { text: "إلغاء", style: "cancel" },
      { text: "حسناً", style: "destructive" },
    ]);
  };

  const title = setupMode ? (firstPin ? "أعد إدخال الرمز" : "أنشئ رمز دخول") : "أدخل رمز الدخول";
  const subtitle = setupMode ? (firstPin ? "للتأكيد" : "4 أرقام لحماية بياناتك") : "للدخول إلى التطبيق";

  const digits: Array<Array<string>> = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "←"],
  ];

  return (
    <View style={styles.root}>
      <View style={styles.topArea}>
        <Image source={require("../../assets/images/flux-product.png")} style={styles.productImage} resizeMode="contain" />
        <Text style={styles.brand}>فلوكس</Text>
        <Text style={styles.brandSub}>مسلك مجاري</Text>
      </View>

      <View style={styles.middleArea}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i < pin.length ? styles.dotFilled : styles.dotEmpty]} />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.pad}>
        {digits.map((row, ri) => (
          <View key={ri} style={styles.padRow}>
            {row.map((d, di) => {
              if (d === "") return <View key={di} style={styles.padBtn} />;
              if (d === "←") {
                return (
                  <Pressable key={di} style={styles.padBtn} onPress={removeDigit}>
                    <Text style={styles.padBtnTextDel}>⌫</Text>
                  </Pressable>
                );
              }
              return (
                <Pressable key={di} style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnPressed]} onPress={() => appendDigit(d)}>
                  <Text style={styles.padBtnText}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable style={styles.forgot} onPress={clearAll}>
        <Text style={styles.forgotText}>{setupMode ? "لا تنساه — لا يمكن استرجاعه" : "نسيت الرمز؟"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 20 },
  topArea: { alignItems: "center", marginBottom: 16 },
  productImage: { width: 140, height: 140, marginBottom: 8 },
  brand: { color: "#FFF", fontSize: 26, fontWeight: "800", textAlign: "center" },
  brandSub: { color: COLORS.blueSoft, fontSize: 12, fontWeight: "700", marginTop: 2 },
  middleArea: { alignItems: "center", marginBottom: 20 },
  title: { color: "#FFF", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  subtitle: { color: "#94A3B8", fontSize: 11, marginBottom: 18 },
  dotsRow: { flexDirection: "row-reverse", gap: 16, marginBottom: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  dotFilled: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  dotEmpty: { backgroundColor: "transparent", borderColor: "#475569" },
  error: { color: "#F87171", fontSize: 12, fontWeight: "700", marginTop: 6 },
  pad: { flex: 1, justifyContent: "center", gap: 10 },
  padRow: { flexDirection: "row-reverse", justifyContent: "center", gap: 16 },
  padBtn: { width: 66, height: 66, borderRadius: 33, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  padBtnPressed: { backgroundColor: "rgba(249,115,22,0.3)" },
  padBtnText: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  padBtnTextDel: { color: COLORS.orange, fontSize: 22, fontWeight: "700" },
  forgot: { alignItems: "center", paddingVertical: 8 },
  forgotText: { color: "#64748B", fontSize: 11, fontWeight: "700" },
});

import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "./theme";

const PIN_KEY = "flux_pin";
const SESSION_KEY = "flux_session";

export async function hasPin(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return !!pin;
}

export async function isSessionActive(): Promise<boolean> {
  return false;
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
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const exists = await hasPin();
      setSetupMode(!exists);
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) setBiometricAvailable(true);
      } catch (e) {
        console.log("biometric check failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (biometricAvailable && !setupMode) {
      setTimeout(() => tryBiometric(), 500);
    }
  }, [biometricAvailable, setupMode]);

  const tryBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "الدخول",
        cancelLabel: "إلغاء",
        disableDeviceFallback: true,
      });
      if (result.success) onUnlock();
    } catch (e) {
      console.log("biometric failed", e);
    }
  };

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
      } else if (firstPin === entered) {
        await setNewPin(entered);
        setSetupMode(false);
        onUnlock();
      } else {
        setError("الرمزان غير متطابقين");
        setPin("");
        setFirstPin("");
      }
    } else {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (saved === entered) onUnlock();
      else {
        setError("رمز خاطئ");
        setPin("");
      }
    }
  };

  const digits: Array<Array<string>> = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["BIO", "0", "DEL"],
  ];

  return (
    <ImageBackground
      source={require("../../assets/images/lock-bg.jpg")}
      style={styles.root}
      imageStyle={{ opacity: 0.75 }}
    >
      <View style={styles.productWrap}>
        <Image
          source={require("../../assets/images/flux-product.png")}
          style={styles.productImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length ? styles.dotFilled : styles.dotEmpty]}
          />
        ))}
      </View>

      <View style={styles.errorWrap}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={{ height: 20 }} />
        )}
      </View>

      <View style={styles.pad}>
        {digits.map((row, ri) => (
          <View key={ri} style={styles.padRow}>
            {row.map((d, di) => {
              if (d === "BIO") {
                return biometricAvailable && !setupMode ? (
                  <Pressable
                    key={di}
                    style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnPressed]}
                    onPress={tryBiometric}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={30} color="#2563EB" />
                  </Pressable>
                ) : (
                  <View key={di} style={styles.padBtn} />
                );
              }
              if (d === "DEL") {
                return (
                  <Pressable
                    key={di}
                    style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnPressed]}
                    onPress={removeDigit}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={28} color="#0B2545" />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={di}
                  style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnPressed]}
                  onPress={() => appendDigit(d)}
                >
                  <Text style={styles.padBtnText}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  productWrap: { alignItems: "center", marginTop: 60, marginBottom: 30 },
  productImage: { width: 180, height: 180 },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
  },
  dotFilled: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  dotEmpty: {
    backgroundColor: "transparent",
    borderColor: "#93C5FD",
  },
  errorWrap: {
    height: 20,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  pad: {
    width: "100%",
    maxWidth: 300, // تصغير عرض اللوحة كاملة
  },
  padRow: {
    flexDirection: "row", // هذا الترتيب يجعل الأرقام 1 2 3 من اليسار لليمين
    justifyContent: "space-between",
    marginBottom: 12,
  },
  padBtn: {
    width: "26%", // تصغير الأزرار
    aspectRatio: 1.15, // تعديل النسبة لتصبح أصغر
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  padBtnPressed: {
    backgroundColor: "#F8FAFC",
    transform: [{ scale: 0.95 }],
  },
  padBtnText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0B2545",
    fontFamily: "CodecBold",
  },
});

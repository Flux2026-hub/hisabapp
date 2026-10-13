import { useEffect, useState } from "react";
import {
  Alert,
  Image,
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
        if (hasHardware && isEnrolled) {
          setBiometricAvailable(true);
        }
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
      if (result.success) {
        onUnlock();
      }
    } catch (e) {
      console.log("biometric failed", e);
    }
  };

  const appendDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      setTimeout(() => handleComplete(next), 200);
    }
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
        onUnlock();
      } else {
        setError("رمز خاطئ");
        setPin("");
      }
    }
  };

  const digits: Array<Array<string>> = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "←"],
  ];

  return (
    <View style={styles.root}>
      {/* ===== صورة المنتج ===== */}
      <View style={styles.productWrap}>
        <View style={styles.productCard}>
          <Image
            source={require("../../assets/images/flux-product.png")}
            style={styles.productImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* ===== مؤشر الوضع ===== */}
      <View style={styles.modeRow}>
        <MaterialCommunityIcons
          name={setupMode ? (firstPin ? "lock-check-outline" : "lock-plus-outline") : "lock-outline"}
          size={18}
          color={COLORS.blue}
        />
      </View>

      {/* ===== نقاط الـ PIN ===== */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </View>

      {/* ===== رسالة الخطأ ===== */}
      <View style={styles.errorWrap}>
        {error ? (
          <>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : (
          <View style={{ height: 18 }} />
        )}
      </View>

      {/* ===== زر البصمة ===== */}
      {biometricAvailable && !setupMode ? (
        <Pressable
          style={({ pressed }) => [
            styles.biometricBtn,
            pressed && styles.biometricBtnPressed,
          ]}
          onPress={tryBiometric}
        >
          <MaterialCommunityIcons
            name="fingerprint"
            size={42}
            color={COLORS.blue}
          />
        </Pressable>
      ) : (
        <View style={styles.biometricPlaceholder} />
      )}

      {/* ===== لوحة الأرقام ===== */}
      <View style={styles.pad}>
        {digits.map((row, ri) => (
          <View key={ri} style={styles.padRow}>
            {row.map((d, di) => {
              if (d === "")
                return <View key={di} style={styles.padBtn} />;
              if (d === "←") {
                return (
                  <Pressable
                    key={di}
                    style={({ pressed }) => [
                      styles.padBtn,
                      styles.padBtnGhost,
                      pressed && styles.padBtnGhostPressed,
                    ]}
                    onPress={removeDigit}
                  >
                    <MaterialCommunityIcons
                      name="backspace-outline"
                      size={28}
                      color={COLORS.text}
                    />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={di}
                  style={({ pressed }) => [
                    styles.padBtn,
                    styles.padBtnPrimary,
                    pressed && styles.padBtnPressed,
                  ]}
                  onPress={() => appendDigit(d)}
                >
                  <Text style={styles.padBtnText}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 30,
  },

  // ===== صورة المنتج =====
  productWrap: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  productCard: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: COLORS.orange,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  productImage: {
    width: 150,
    height: 150,
  },

  // ===== المؤشر =====
  modeRow: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },

  // ===== النقاط =====
  dotsRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 20,
    marginBottom: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  dotFilled: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  },
  dotEmpty: {
    backgroundColor: "transparent",
    borderColor: COLORS.blueSoft,
  },

  // ===== الخطأ =====
  errorWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 18,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
  },

  // ===== البصمة =====
  biometricBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.blueSoft,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  biometricBtnPressed: {
    backgroundColor: COLORS.bluePale,
    transform: [{ scale: 0.94 }],
  },
  biometricPlaceholder: {
    height: 68,
    marginBottom: 16,
  },

  // ===== لوحة الأرقام =====
  pad: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  padRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 24,
  },
  padBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  padBtnPrimary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(11, 37, 69, 0.04)",
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  padBtnPressed: {
    backgroundColor: COLORS.orangePale,
    transform: [{ scale: 0.93 }],
    shadowOpacity: 0.04,
  },
  padBtnGhost: {
    backgroundColor: "transparent",
  },
  padBtnGhostPressed: {
    backgroundColor: "rgba(11, 37, 69, 0.06)",
  },
  padBtnText: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
  },
});

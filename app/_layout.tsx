import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { I18nManager, View, ActivityIndicator, Text } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { initializeLocalDatabase } from "../src/db/local";
import LockScreen, { isSessionActive } from "../src/ui/LockScreen";
import { ThemeProvider } from "../src/ui/ThemeContext";
import { ToastProvider } from "../src/ui/ToastContext"; // 🚀 استدعاء نظام الإشعارات
import { runAutoBackup } from "../src/utils/autoBackup";

SplashScreen.preventAutoHideAsync().catch(() => {});
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Alexandria-Black": require("../assets/fonts/Alexandria-Black.ttf"),
    "Alexandria-Regular": require("../assets/fonts/Alexandria-Regular.ttf"),
    "CodecBold": require("../assets/fonts/Codec-Bold.ttf"),
  });
  
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initializeLocalDatabase();
        const session = await isSessionActive();
        setUnlocked(session);
        runAutoBackup().catch(console.error);
      } catch (e: any) {
        console.error("DB Error:", e);
        setDbError(e.message || "حدث خطأ");
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B2545" }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#7f1d1d", padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>{dbError}</Text>
      </View>
    );
  }

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <ThemeProvider>
      {/* 🚀 تغليف التطبيق بنظام الإشعارات */}
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </ThemeProvider>
  );
}

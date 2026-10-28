import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { I18nManager, View, ActivityIndicator, Text } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { initializeLocalDatabase } from "../src/db/local";
import LockScreen, { isSessionActive } from "../src/ui/LockScreen";

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
        console.log("1️⃣ بدء تهيئة قاعدة البيانات...");
        await initializeLocalDatabase();
        
        console.log("2️⃣ تمت تهيئة قاعدة البيانات بنجاح. جاري فحص الجلسة...");
        const session = await isSessionActive();
        setUnlocked(session);
        
        console.log("3️⃣ اكتمل فحص الجلسة.");
      } catch (e: any) {
        console.error("❌ خطأ في قاعدة البيانات:", e);
        setDbError(e.message || "حدث خطأ غير معروف");
      } finally {
        console.log("4️⃣ تم إنهاء التحميل، جاري إخفاء شاشة البداية.");
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B2545" }}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: 'white', marginTop: 15 }}>جاري التهيئة...</Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#7f1d1d", padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>خطأ في قاعدة البيانات:</Text>
        <Text style={{ color: 'white', fontSize: 14, textAlign: 'center' }}>{dbError}</Text>
      </View>
    );
  }

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

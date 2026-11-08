import { Stack } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { I18nManager, View, ActivityIndicator, Text, AppState } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { initializeLocalDatabase, sqlite } from "../src/db/local";
import LockScreen, { isSessionActive } from "../src/ui/LockScreen";
import { ThemeProvider } from "../src/ui/ThemeContext";
import { ToastProvider } from "../src/ui/ToastContext";
import { runAutoBackup } from "../src/utils/autoBackup";
import { checkAndSendAutoBackup } from "../src/utils/telegramAutoBackup";
import { checkTelegramCommands } from "../src/utils/telegram";

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
  
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchCommands = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        await checkTelegramCommands();
      } catch (e) {
        console.error("Bot check error:", e);
      } finally {
        isProcessingRef.current = false;
      }
    };

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(fetchCommands, 10000);
    };

    (async () => {
      try {
        await initializeLocalDatabase();
        
        // ✅ ترحيل: توحيد تسلسل أرقام العملاء
        try {
          const customers: any = await sqlite.getAllAsync("SELECT id, code FROM customers ORDER BY created_at ASC");
          if (customers && customers.length > 0) {
            for (let i = 0; i < customers.length; i++) {
              const expectedCode = `CUS-${String(i + 1).padStart(3, '0')}`;
              if (customers[i].code !== expectedCode) {
                await sqlite.runAsync("UPDATE customers SET code = ? WHERE id = ?", [expectedCode, customers[i].id]);
              }
            }
            console.log("✅ Customer codes unified successfully.");
          }
        } catch (e) {
          console.log("Migration error:", e);
        }

        const session = await isSessionActive();
        setUnlocked(session);

        runAutoBackup().catch(console.error);
        checkAndSendAutoBackup().catch(console.error);

        fetchCommands();
        startPolling();

      } catch (e: any) {
        console.error("DB Error:", e);
        setDbError(e.message || "حدث خطأ");
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        startPolling();
      } else {
        if (intervalId) clearInterval(intervalId);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      subscription.remove();
    };
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
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}

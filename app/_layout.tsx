import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { I18nManager, View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
import { initializeLocalDatabase } from "../src/db/local";
import LockScreen, { isSessionActive } from "../src/ui/LockScreen";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Alexandria-Black": require("../assets/fonts/Alexandria-Black.ttf"),
    "CodecBold": require("../assets/fonts/Codec-Bold.ttf"),
  });
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      await initializeLocalDatabase();
      const session = await isSessionActive();
      setUnlocked(session);
      setReady(true);
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0B2545",
        }}
      >
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

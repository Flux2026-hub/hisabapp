import { Stack } from "expo-router";
import { useEffect } from "react";
import { I18nManager, View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
import { initializeLocalDatabase } from "../src/db/local";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Alexandria-Black": require("../assets/fonts/Alexandria-Black.ttf"),
    "CodecBold": require("../assets/fonts/Codec-Bold.ttf"),
  });

  useEffect(() => {
    void initializeLocalDatabase();
  }, []);

  if (!fontsLoaded) {
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

  return <Stack screenOptions={{ headerShown: false }} />;
}

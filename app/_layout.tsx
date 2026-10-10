import { Stack } from "expo-router";
import { useEffect } from "react";
import { I18nManager } from "react-native";
import { initializeLocalDatabase } from "../src/db/local";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  useEffect(() => { void initializeLocalDatabase(); }, []);
  return <Stack screenOptions={{ headerShown: false }} />;
}

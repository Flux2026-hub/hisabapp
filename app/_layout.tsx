import { Stack } from 'expo-router';
import CustomHeader from '../src/ui/components/CustomHeader';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        header: ({ options }) => (
          <CustomHeader 
            title={options.title} 
            onMenuPress={() => {}} 
            onSearchPress={() => {}} 
          />
        ),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'فلوكس' }} />
    </Stack>
  );
}

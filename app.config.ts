import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'hisabapp',
  slug: 'hisabapp',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.flux.hisabapp'
  },
  android: {
    package: 'com.flux.hisabapp.v2'
  },
  web: {
    bundler: 'metro',
    output: 'static'
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-contacts',
      {
        contactsPermission: 'نحتاج صلاحية الوصول لجهات الاتصال لاختيار أرقام الهواتف.'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  }
});

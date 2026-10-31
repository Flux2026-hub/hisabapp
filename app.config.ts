import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'hisabapp',
  slug: 'hisabapp',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.flux.hisabapp'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0B2545'
    },
    package: 'com.flux.hisabapp'
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png'
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'نحتاج صلاحية الكاميرا لمسح الباركود.'
      }
    ],
    [
      'expo-contacts',
      {
        contactsPermission: 'نحتاج صلاحية الوصول لجهات الاتصال لاختيار أرقام الهواتف.'
      }
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0B2545'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  }
});

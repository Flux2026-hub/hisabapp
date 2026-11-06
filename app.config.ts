import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'hisabapp',
  slug: 'hisabapp',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.flux.hisabapp'
  },
  android: {
    package: 'com.flux.hisabapp.v2',
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#0B2545',
      monochromeImage: './assets/images/android-icon-monochrome.png'
    }
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
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0B2545'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: '187ad966-f690-427d-9ca2-a02f29af2606'
    }
  }
});

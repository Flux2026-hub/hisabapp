import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#051A34', '#0B2545', '#133A68', '#0B2545']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 10 }]}
    >
      {/* القسم بأكمله على اليسار */}
      <View style={styles.brandSection}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <View style={styles.divider} />
        
        <View style={styles.textContainer}>
          <Text style={styles.titleText}>{title || 'فلوكس'}</Text>
          <Text style={styles.subtitleText}>لأنابيب أكثر نظافة</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // في RTL، هذا يدفع العناصر إلى أقصى اليسار
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 90,
    height: 55,
  },
  divider: {
    width: 1,
    height: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Cairo',
  },
  subtitleText: {
    color: '#A0B3C6',
    fontSize: 13,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Cairo',
  },
});

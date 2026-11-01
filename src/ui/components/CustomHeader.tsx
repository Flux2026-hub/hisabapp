import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomHeader({ title, onMenuPress, onSearchPress }: { title?: string, onMenuPress?: () => void, onSearchPress?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#0B2545', '#133a68']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.brandSection}>
        <Image source={require('../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.divider} />
        <View style={styles.textContainer}>
          <Text style={styles.titleText}>{title || 'فلوكس'}</Text>
          <Text style={styles.subtitleText}>لأنابيب أكثر نظافة</Text>
        </View>
      </View>
      <View style={styles.actionSection}>
        <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
          <Ionicons name="menu" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  brandSection: { flexDirection: 'row', alignItems: 'center', flex: 2 },
  logo: { width: 85, height: 50 },
  divider: { width: 1, height: 35, backgroundColor: 'rgba(255, 255, 255, 0.3)', marginHorizontal: 12 },
  textContainer: { alignItems: 'flex-start' },
  titleText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'System' : 'Cairo' },
  subtitleText: { color: '#A0B3C6', fontSize: 13, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'System' : 'Cairo' },
  actionSection: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  iconButton: { padding: 5 },
});

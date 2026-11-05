import React, { useRef, useState, useCallback } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
export const BANNER_IMAGE_KEY_1 = '@flux_banner_1';
export const BANNER_IMAGE_KEY_2 = '@flux_banner_2';

export default function PromoCarousel() {
  // الحالة الافتراضية: صورتين فارغتين
  const [images, setImages] = useState<(string | null)[]>([null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const loadImages = async () => {
    try {
      const [img1, img2] = await Promise.all([
        AsyncStorage.getItem(BANNER_IMAGE_KEY_1),
        AsyncStorage.getItem(BANNER_IMAGE_KEY_2)
      ]);
      
      let validImg1 = null;
      let validImg2 = null;
      
      if (img1) {
        const info = await FileSystem.getInfoAsync(img1);
        if (info.exists) validImg1 = img1;
      }
      if (img2) {
        const info = await FileSystem.getInfoAsync(img2);
        if (info.exists) validImg2 = img2;
      }
      
      setImages([validImg1, validImg2]);
    } catch (e) { console.log("Error loading banners", e); }
  };

  useFocusEffect(
    useCallback(() => {
      loadImages();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        setActiveIndex((prev) => {
          const next = (prev + 1) % 2;
          flatListRef.current?.scrollToOffset({ offset: next * width, animated: true });
          return next;
        });
      }, 4000);
      return () => clearInterval(timer);
    }, [])
  );

  const renderItem = ({ item, index }: { item: string | null, index: number }) => (
    <View style={styles.slide}>
      {item ? (
        <Image 
          key={item} // إجبار التحديث
          source={{ uri: item }} 
          style={styles.image} 
          resizeMode="cover" 
        />
      ) : (
        <View style={styles.placeholder}>
          <Image source={require('../../../assets/images/flux-logo.png')} style={{ width: 100, height: 75, opacity: 0.2 }} resizeMode="contain" />
          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 10 }}>لا توجد صورة {index + 1}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList 
        ref={flatListRef} 
        // ✅ هذا هو الإصلاح الجوهري: تمرير المصفوفة الحقيقية بدلاً من الأرقام
        data={images} 
        renderItem={renderItem} 
        keyExtractor={(_, i) => i.toString()} 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false} 
        onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))} 
      />
      <View style={styles.pagination}>
        {[0, 1].map(i => <View key={i} style={[styles.dot, activeIndex === i && styles.activeDot]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: width, height: 200, marginVertical: 10 },
  slide: { width: width, height: 200, paddingHorizontal: 16 },
  image: { width: '100%', height: '100%', borderRadius: 16 },
  placeholder: { width: '100%', height: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#BAE6FD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  pagination: { flexDirection: 'row', position: 'absolute', bottom: 8, alignSelf: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  activeDot: { backgroundColor: '#F97316', width: 24 },
});

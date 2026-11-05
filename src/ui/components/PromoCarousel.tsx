import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
export const BANNER_IMAGE_KEY_1 = '@flux_banner_1';
export const BANNER_IMAGE_KEY_2 = '@flux_banner_2';

export default function PromoCarousel() {
  const [images, setImages] = useState<(string | null)[]>([null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const loadImages = async () => {
    try {
      const [img1, img2] = await Promise.all([
        AsyncStorage.getItem(BANNER_IMAGE_KEY_1),
        AsyncStorage.getItem(BANNER_IMAGE_KEY_2)
      ]);
      setImages([img1 || null, img2 || null]);
    } catch (e) { console.log("Error loading banners", e); }
  };

  useFocusEffect(useCallback(() => { loadImages(); }, []));

  // حركة سلسة بين الصورتين
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = prevIndex === 0 ? 1 : 0;
        flatListRef.current?.scrollToOffset({ offset: nextIndex * width, animated: true });
        return nextIndex;
      });
    }, 5000); // كل 5 ثوانٍ
    return () => clearInterval(timer);
  }, []);

  const renderItem = ({ item, index }: { item: string | null, index: number }) => (
    <View style={styles.slide}>
      <View style={styles.imageWrapper}>
        {item ? (
          <Image key={item} source={{ uri: item }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Image source={require('../../../assets/images/flux-logo.png')} style={{ width: 100, height: 75, opacity: 0.2 }} resizeMode="contain" />
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 10 }}>لا توجد صورة {index + 1}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList 
        ref={flatListRef} 
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
  imageWrapper: { width: '100%', height: '100%', borderRadius: 16, backgroundColor: '#FFF', shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 6.68, elevation: 10 },
  image: { width: '100%', height: '100%', borderRadius: 16 },
  placeholder: { width: '100%', height: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#BAE6FD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  pagination: { flexDirection: 'row', position: 'absolute', bottom: 8, alignSelf: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  activeDot: { backgroundColor: '#F97316', width: 24 },
});

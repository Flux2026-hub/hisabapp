import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, FlatList, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const BANNER_IMAGE_KEY_1 = '@flux_banner_1';
const BANNER_IMAGE_KEY_2 = '@flux_banner_2';

export default function PromoCarousel() {
  const [images, setImages] = useState<(string | null)[]>([null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(BANNER_IMAGE_KEY_1), AsyncStorage.getItem(BANNER_IMAGE_KEY_2)])
      .then(([img1, img2]) => setImages([img1, img2]));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % 2;
        flatListRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const pickImage = async (index: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      aspect: [16, 9], 
      quality: 0.8 
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await AsyncStorage.setItem(index === 0 ? BANNER_IMAGE_KEY_1 : BANNER_IMAGE_KEY_2, uri);
      const newImgs = [...images]; 
      newImgs[index] = uri; 
      setImages(newImgs);
    }
  };

  const renderItem = ({ item, index }: { item: string | null, index: number }) => (
    <View style={styles.slide}>
      {item ? (
        <>
          <Image source={{ uri: item }} style={styles.image} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.overlay}>
            <Text style={styles.title}>{index === 0 ? 'ملك السرعة' : 'عرض خاص'}</Text>
            <TouchableOpacity style={styles.btn}><Text style={styles.btnText}>أطلب الآن</Text></TouchableOpacity>
          </LinearGradient>
        </>
      ) : (
        <TouchableOpacity style={styles.placeholder} onPress={() => pickImage(index)}>
          <MaterialCommunityIcons name="image-plus" size={40} color="#38BDF8" />
          <Text style={styles.placeholderText}>اضغط لاختيار الصورة {index + 1}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.editBtn} onPress={() => pickImage(index)}>
        <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList ref={flatListRef} data={['0', '1']} renderItem={renderItem} keyExtractor={(_, i) => i.toString()} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))} />
      <View style={styles.pagination}>{[0, 1].map(i => <View key={i} style={[styles.dot, activeIndex === i && styles.activeDot]} />)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: width, height: 200, marginVertical: 10 },
  slide: { width: width, height: 200, paddingHorizontal: 16 },
  image: { width: '100%', height: '100%', borderRadius: 16 },
  overlay: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 100, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, justifyContent: 'flex-end', padding: 16, alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFF', fontFamily: 'Cairo' },
  btn: { backgroundColor: '#F97316', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', fontFamily: 'Cairo' },
  placeholder: { width: '100%', height: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#BAE6FD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#0284C7', fontSize: 14, marginTop: 8, fontFamily: 'Cairo' },
  editBtn: { position: 'absolute', top: 12, right: 28, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  pagination: { flexDirection: 'row', position: 'absolute', bottom: 8, alignSelf: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  activeDot: { backgroundColor: '#F97316', width: 24 },
});

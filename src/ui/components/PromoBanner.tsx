import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const BANNER_IMAGE_KEY = '@flux_banner_image';

export default function PromoBanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    AsyncStorage.getItem(BANNER_IMAGE_KEY).then((uri) => {
      if (uri) setImageUri(uri);
    });

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 7],
      quality: 0.8,
    });

    if (!result.canceled) {
      const sourceUri = result.assets[0].uri;
      const fileName = `promo_banner_${Date.now()}.jpg`;
      const destUri = FileSystem.documentDirectory + fileName;

      try {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        await AsyncStorage.setItem(BANNER_IMAGE_KEY, destUri);
        setImageUri(destUri);
      } catch (error) {
        Alert.alert("خطأ", "تعذر حفظ الصورة");
      }
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={['#E0F2FE', '#BAE6FD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <TouchableOpacity style={styles.editBtn} onPress={pickImage}>
          <MaterialCommunityIcons name="camera" size={20} color="#0284C7" />
        </TouchableOpacity>

        <View style={styles.textSection}>
          <Text style={styles.title}>ملك السرعة</Text>
          <Text style={styles.subtitle}>بألوانه الجديدة</Text>
          <Text style={styles.desc}>(الأزرق - الأسود - التيتانيوم)</Text>
          
          <TouchableOpacity style={styles.btn}>
            <Text style={styles.btnText}>أطلب الآن</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.imageSection}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <TouchableOpacity style={styles.placeholder} onPress={pickImage}>
              <MaterialCommunityIcons name="image-plus" size={40} color="#38BDF8" />
              <Text style={styles.placeholderText}>اختر صورة</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  banner: {
    flexDirection: 'row-reverse',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  editBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 20,
    elevation: 2,
    zIndex: 10,
  },
  textSection: {
    flex: 1.2,
    alignItems: 'flex-start',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0369A1', fontFamily: 'Cairo' },
  subtitle: { fontSize: 14, color: '#0284C7', marginTop: 2, fontFamily: 'Cairo' },
  desc: { fontSize: 10, color: '#38BDF8', marginTop: 4, marginBottom: 12, fontFamily: 'Cairo' },
  btn: { backgroundColor: '#0284C7', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', fontFamily: 'Cairo' },
  imageSection: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 100,
  },
  image: {
    width: 140,
    height: 100,
  },
  placeholder: {
    width: 120,
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#0284C7',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Cairo',
  }
});

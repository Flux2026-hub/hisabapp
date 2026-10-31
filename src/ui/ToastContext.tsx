import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet, View, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider = ({ children }: any) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  
  const translateY = useRef(new Animated.Value(-100)).current;

  const showToast = (msg: string, toastType: ToastType = 'info') => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.spring(translateY, {
      toValue: 50, // تظهر أسفل الحافة العلوية قليلاً
      useNativeDriver: true,
      bounciness: 10,
    }).start();

    setTimeout(() => {
      hideToast();
    }, 3000); // تختفي بعد 3 ثوان
  };

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const getBackgroundColor = () => {
    if (type === 'success') return '#10B981'; // أخضر
    if (type === 'error') return '#EF4444';   // أحمر
    return '#3B82F6';                         // أزرق
  };

  const getIcon = () => {
    if (type === 'success') return 'check-circle';
    if (type === 'error') return 'alert-circle';
    return 'information';
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View style={[styles.toastContainer, { backgroundColor: getBackgroundColor(), transform: [{ translateY }] }]}>
          <MaterialCommunityIcons name={getIcon() as any} size={24} color="#FFF" />
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
    gap: 10,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Alexandria-Regular',
    textAlign: 'right',
  },
});

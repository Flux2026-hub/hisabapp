import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { saveTelegramSettings, getTelegramSettings, sendTelegramMessage } from '../../utils/telegram';

export default function TelegramSettings() {
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getTelegramSettings().then(data => {
      if (data.token) setTgToken(data.token);
      if (data.chatId) setTgChatId(data.chatId);
    });
  }, []);

  const handleSave = async () => {
    if (!tgToken || !tgChatId) {
      Alert.alert('تنبيه', 'الرجاء إدخال التوكن و Chat ID');
      return;
    }
    setIsLoading(true);
    const success = await saveTelegramSettings(tgToken, tgChatId);
    setIsLoading(false);
    if (success) Alert.alert('نجاح', 'تم حفظ الإعدادات بنجاح');
  };

  const handleTest = async () => {
    setIsLoading(true);
    try {
      await sendTelegramMessage('✅ <b>نجح الاتصال!</b>\nهذه رسالة تجريبية من تطبيق فلوكس المحاسبي.');
      Alert.alert('نجاح', 'تم إرسال الرسالة لتليجرام، تفقد هاتفك!');
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>إعدادات بوت تليجرام</Text>
      <Text style={styles.subtitle}>اربط التطبيق بالبوت لاستلام الإشعارات</Text>
      
      <TextInput
        placeholder="Bot Token"
        style={styles.input}
        value={tgToken}
        onChangeText={setTgToken}
        autoCapitalize="none"
      />
      
      <TextInput
        placeholder="Chat ID"
        style={styles.input}
        value={tgChatId}
        onChangeText={setTgChatId}
        keyboardType="numeric"
      />
      
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>حفظ الإعدادات</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.testButton} onPress={handleTest} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال رسالة تجريبية</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#0B2545', marginBottom: 5, textAlign: 'right' },
  subtitle: { fontSize: 12, color: '#6b7280', marginBottom: 15, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#d1d5db', padding: 10, marginBottom: 10, borderRadius: 8, textAlign: 'left' },
  saveButton: { backgroundColor: '#0B2545', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  testButton: { backgroundColor: '#F97316', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

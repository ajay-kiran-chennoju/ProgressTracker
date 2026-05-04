import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Lock, Save, LogOut } from 'lucide-react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { user, rename, updatePin, clearUser } = useCurrentUser();
  const [name, setName] = useState(user?.name || '');
  const [pin, setPin] = useState(user?.pin || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    if (pin && !/^[0-9]{4,8}$/.test(pin)) {
      Alert.alert('Error', 'PIN must be 4-8 digits');
      return;
    }

    setSaving(true);
    try {
      // Update in Supabase
      const { error } = await supabase
        .from('participants')
        .update({ name: name.trim(), pin: pin })
        .eq('slot', user?.slot);

      if (error) throw error;

      // Update local state
      rename(name.trim());
      updatePin(pin);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out of this participant?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: clearUser }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            
            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <User size={18} color="#666" />
                <Text style={styles.label}>Display Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Lock size={18} color="#666" />
                <Text style={styles.label}>Security PIN (4-8 digits)</Text>
              </View>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                placeholder="Enter PIN"
                keyboardType="numeric"
                secureTextEntry
                maxLength={8}
              />
            </View>

            <Pressable 
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              <Save size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>

          <View style={[styles.section, styles.dangerZone]}>
            <Text style={[styles.sectionTitle, { color: '#FF3B30' }]}>Danger Zone</Text>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={20} color="#FF3B30" />
              <Text style={styles.logoutBtnText}>Switch Participant / Logout</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  saveBtn: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerZone: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 10,
  },
  logoutBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

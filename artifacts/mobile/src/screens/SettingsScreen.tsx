/**
 * SettingsScreen.tsx
 *
 * Profile settings + Theme Color Customization section.
 * Theme is persisted via AsyncStorage through ThemeContext.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Alert,
  KeyboardAvoidingView, Platform, ScrollView, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Lock, Save, LogOut, Palette, Check } from 'lucide-react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { supabase } from '../lib/supabase';
import { useTheme, THEMES, ThemeId } from '../lib/theme';

export default function SettingsScreen() {
  const { user, rename, updatePin, clearUser } = useCurrentUser();
  const { themeId, colors, setThemeId } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [pin, setPin] = useState(user?.pin || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    if (pin && !/^[0-9]{4,8}$/.test(pin)) { Alert.alert('Error', 'PIN must be 4-8 digits'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('participants')
        .update({ name: name.trim(), pin })
        .eq('slot', user?.slot);
      if (error) throw error;
      rename(name.trim());
      updatePin(pin);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: clearUser },
    ]);
  };

  const s = mkStyles(colors);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scrollContent}>

          {/* ── Profile Section ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Profile Information</Text>

            <View style={s.inputGroup}>
              <View style={s.inputHeader}>
                <User size={18} color={colors.textSecondary} />
                <Text style={s.label}>Display Name</Text>
              </View>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={s.inputGroup}>
              <View style={s.inputHeader}>
                <Lock size={18} color={colors.textSecondary} />
                <Text style={s.label}>Security PIN (4-8 digits)</Text>
              </View>
              <TextInput
                style={s.input}
                value={pin}
                onChangeText={setPin}
                placeholder="Enter PIN"
                keyboardType="numeric"
                secureTextEntry
                maxLength={8}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              <Save size={20} color="#FFF" />
              <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>

          {/* ── Theme Section ── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Palette size={20} color={colors.primary} />
              <Text style={[s.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>Theme Colors</Text>
            </View>
            <Text style={s.themeHint}>Tap a theme to apply it instantly across the app.</Text>

            <FlatList
              data={THEMES}
              keyExtractor={t => t.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.themeList}
              renderItem={({ item }) => {
                const isActive = item.id === themeId;
                return (
                  <Pressable
                    style={[
                      s.themeCard,
                      { borderColor: isActive ? item.colors.primary : colors.border },
                      isActive && { backgroundColor: item.colors.primaryLight },
                    ]}
                    onPress={() => setThemeId(item.id as ThemeId)}
                  >
                    {/* Color swatch row */}
                    <View style={s.swatchRow}>
                      {[item.colors.primary, item.colors.accent, item.colors.primaryLight].map((c, i) => (
                        <View key={i} style={[s.swatch, { backgroundColor: c }]} />
                      ))}
                    </View>
                    <Text style={[s.themeEmoji]}>{item.emoji}</Text>
                    <Text style={[s.themeLabel, { color: isActive ? item.colors.primary : colors.text }]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <View style={[s.checkBadge, { backgroundColor: item.colors.primary }]}>
                        <Check size={12} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </View>

          {/* ── Danger Zone ── */}
          <View style={[s.section, s.dangerZone]}>
            <Text style={[s.sectionTitle, { color: '#EF4444' }]}>Danger Zone</Text>
            <Pressable style={s.logoutBtn} onPress={handleLogout}>
              <LogOut size={20} color="#EF4444" />
              <Text style={s.logoutBtnText}>Switch Participant / Logout</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const mkStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20 },
  section: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20, color: colors.text },
  inputGroup: { marginBottom: 20 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, fontSize: 16, color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 15, borderRadius: 12, marginTop: 10, gap: 10,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  themeHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  themeList: { paddingBottom: 4, gap: 12 },
  themeCard: {
    width: 100, borderRadius: 14, borderWidth: 2, padding: 12,
    alignItems: 'center', backgroundColor: colors.surface, position: 'relative',
  },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  themeEmoji: { fontSize: 22, marginBottom: 4 },
  themeLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  checkBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  dangerZone: { marginTop: 4, borderWidth: 1, borderColor: '#FFE5E5' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', gap: 10,
  },
  logoutBtnText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold' },
});

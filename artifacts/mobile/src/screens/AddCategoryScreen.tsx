import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { safeFetchCategoryTitleSuggestions } from '../lib/dbSafeHelpers';
import { invokeNavCallback } from '../lib/navigationCallbacks';
import { useTheme } from '../lib/theme';

const normalizeCategoryTitle = (t: string) => t.trim().toLowerCase();

export default function AddCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { date, slot, callbackKey } = route.params;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [allTitles, setAllTitles] = useState<string[]>([]);

  useEffect(() => {
    safeFetchCategoryTitleSuggestions(slot)
      .then(setAllTitles)
      .catch(err => console.error('Error fetching suggestions:', err));
  }, [slot]);

  const suggestions = useMemo(() => {
    if (!title.trim()) return [];
    const norm = normalizeCategoryTitle(title);
    return allTitles
      .filter(t => t.toLowerCase().includes(norm) && t.toLowerCase() !== norm)
      .slice(0, 5);
  }, [title, allTitles]);

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    Keyboard.dismiss();

    try {
      const normalized = normalizeCategoryTitle(trimmed);

      // Day-specific duplicate check
      const { data: existing, error: fetchErr } = await supabase
        .from('categories')
        .select('*')
        .eq('slot', slot)
        .eq('date', date)
        .eq('is_deleted', false);
      if (fetchErr) throw fetchErr;

      const matched = existing?.find(
        c => normalizeCategoryTitle(c.title) === normalized,
      );

      const resultCat = matched ?? await (async () => {
        const { data, error } = await supabase
          .from('categories')
          .insert([{ slot, date, title: trimmed, is_deleted: false }])
          .select()
          .single();
        if (error) throw error;
        return data;
      })();

      // Fire callback → DayScreen updates optimistically
      invokeNavCallback(callbackKey, resultCat);
      navigation.goBack();
    } catch (err: any) {
      console.error('Error adding category:', err);
      Alert.alert('Error', err.message || 'Could not add category');
    } finally {
      setLoading(false);
    }
  };

  const s = mkStyles(colors);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Add Category</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.content}
      >
        <View style={s.inputContainer}>
          <Text style={s.label}>Category Name</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Coding, Reading, Workout"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>

        {suggestions.length > 0 && (
          <View style={s.suggestionsList}>
            <Text style={s.suggestionHeader}>Suggestions</Text>
            {suggestions.map((item, i) => (
              <Pressable key={i} style={s.suggestionItem} onPress={() => setTitle(item)}>
                <Text style={s.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          style={[s.addBtn, (!title.trim() || loading) && s.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!title.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.addBtnText}>Add Category</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const mkStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  content: { flex: 1, padding: 20 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, fontSize: 16, color: colors.text,
  },
  suggestionsList: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, marginBottom: 20, overflow: 'hidden',
  },
  suggestionHeader: {
    fontSize: 12, fontWeight: 'bold', color: colors.textSecondary,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, textTransform: 'uppercase',
  },
  suggestionItem: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  suggestionText: { fontSize: 15, color: colors.text },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 'auto', marginBottom: 20,
  },
  addBtnDisabled: { backgroundColor: colors.border },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

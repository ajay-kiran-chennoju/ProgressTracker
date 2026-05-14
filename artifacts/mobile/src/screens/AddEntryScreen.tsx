import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { safeFetchItemContentSuggestions } from '../lib/dbSafeHelpers';
import { invokeNavCallback } from '../lib/navigationCallbacks';
import { useTheme } from '../lib/theme';

const normalizeContent = (t: string) => t.trim().toLowerCase();

export default function AddEntryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { categoryId, categoryTitle, date, callbackKey } = route.params;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [allContents, setAllContents] = useState<string[]>([]);

  useEffect(() => {
    safeFetchItemContentSuggestions(categoryId)
      .then(setAllContents)
      .catch(err => console.error('Error fetching suggestions:', err));
  }, [categoryId]);

  const suggestions = useMemo(() => {
    if (!content.trim()) return [];
    const norm = normalizeContent(content);
    return allContents
      .filter(c => c.toLowerCase().includes(norm) && c.toLowerCase() !== norm)
      .slice(0, 5);
  }, [content, allContents]);

  const handleAdd = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setLoading(true);
    Keyboard.dismiss();

    try {
      const normalized = normalizeContent(trimmed);

      // Duplicate guard
      const { data: existing, error: fetchErr } = await supabase
        .from('items')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_deleted', false);
      if (fetchErr) throw fetchErr;

      const matched = existing?.find(
        item => normalizeContent(item.content) === normalized,
      );

      const resultItem = matched ?? await (async () => {
        const { data, error } = await supabase
          .from('items')
          .insert([{ category_id: categoryId, content: trimmed, date }])
          .select()
          .single();
        if (error) throw error;
        return data;
      })();

      // Fire callback → caller updates its own state optimistically
      invokeNavCallback(callbackKey, resultItem, categoryId);
      navigation.goBack();
    } catch (err: any) {
      console.error('Error adding entry:', err);
      Alert.alert('Error', err.message || 'Could not add entry');
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
        <View style={s.headerTitleContainer}>
          <Text style={s.headerTitle}>Add Entry</Text>
          <Text style={s.headerSubtitle}>{categoryTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.content}
      >
        <View style={s.inputContainer}>
          <Text style={s.label}>What did you achieve?</Text>
          <TextInput
            style={[s.input, s.multilineInput]}
            placeholder="Describe your progress..."
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            autoFocus
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {suggestions.length > 0 && (
          <View style={s.suggestionsList}>
            <Text style={s.suggestionHeader}>Previous entries</Text>
            {suggestions.map((item, i) => (
              <Pressable key={i} style={s.suggestionItem} onPress={() => setContent(item)}>
                <Text style={s.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          style={[s.addBtn, (!content.trim() || loading) && s.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!content.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.addBtnText}>Save Entry</Text>}
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
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 2 },
  content: { flex: 1, padding: 20 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, fontSize: 16, color: colors.text,
  },
  multilineInput: { minHeight: 120 },
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

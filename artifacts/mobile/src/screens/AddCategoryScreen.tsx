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

// ─── Normalization helper ─────────────────────────────────────────────────────
const normalizeCategoryTitle = (t: string) => t.trim().toLowerCase();

export default function AddCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { date, slot } = route.params;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [allCategoryTitles, setAllCategoryTitles] = useState<string[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(true);

  // ── Load existing titles for suggestions and duplicate checks ──────────────
  useEffect(() => {
    async function fetchAllCategories() {
      try {
        const uniqueTitles = await safeFetchCategoryTitleSuggestions(slot);
        setAllCategoryTitles(uniqueTitles);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setFetchingSuggestions(false);
      }
    }
    fetchAllCategories();
  }, [slot]);

  // ── Filtered suggestions ────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!title.trim()) return [];
    const norm = normalizeCategoryTitle(title);
    return allCategoryTitles
      .filter(t => t.toLowerCase().includes(norm) && t.toLowerCase() !== norm)
      .slice(0, 5);
  }, [title, allCategoryTitles]);

  // ── Main handler ────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setLoading(true);
    Keyboard.dismiss();

    try {
      const normalizedTitle = normalizeCategoryTitle(trimmedTitle);

      // ── Slot-wide normalized duplicate check ──────────────────────────────
      // Fetch ALL active categories for this slot (not just this date).
      // A canonical category should be unique per (normalized title + date + slot).
      const { data: existingSlotCats, error: fetchErr } = await supabase
        .from('categories')
        .select('*')
        .eq('slot', slot)
        .eq('is_deleted', false);

      if (fetchErr) throw fetchErr;

      const matched = existingSlotCats?.find(
        c => normalizeCategoryTitle(c.title) === normalizedTitle,
      );

      if (matched) {
        // Reuse existing category — navigate back with it so DayScreen updates
        navigation.navigate('Day', { date, newCategory: matched });
        return;
      }

      // ── Create new category ────────────────────────────────────────────────
      const { data: newCat, error: insertErr } = await supabase
        .from('categories')
        .insert([{ slot, date, title: trimmedTitle, is_deleted: false }])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Pop this screen and pass the new category back to DayScreen
      navigation.navigate('Day', { date, newCategory: newCat });
    } catch (error: any) {
      console.error('Error adding category:', error);
      Alert.alert('Error', error.message || 'Could not add category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Add Category</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Category Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Coding, Reading, Workout"
            value={title}
            onChangeText={setTitle}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            <Text style={styles.suggestionHeader}>Suggestions</Text>
            {suggestions.map((item, index) => (
              <Pressable
                key={index}
                style={styles.suggestionItem}
                onPress={() => setTitle(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.addBtn, (!title.trim() || loading) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!title.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.addBtnText}>Add Category</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  content: { flex: 1, padding: 20 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  suggestionsList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 20,
    overflow: 'hidden',
  },
  suggestionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  suggestionText: { fontSize: 15, color: '#333' },
  addBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  addBtnDisabled: { backgroundColor: '#CCC' },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

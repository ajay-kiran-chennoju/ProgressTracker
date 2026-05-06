import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function AddEntryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { categoryId, categoryTitle, date } = route.params;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [allContents, setAllContents] = useState<string[]>([]);

  useEffect(() => {
    async function fetchExistingContents() {
      try {
        const { data } = await supabase
          .from('items')
          .select('content')
          .eq('category_id', categoryId);
        const unique = Array.from(new Set(data?.map(i => i.content) || []));
        setAllContents(unique);
      } catch (err) {
        console.error('Error fetching item suggestions:', err);
      }
    }
    fetchExistingContents();
  }, [categoryId]);

  const suggestions = useMemo(() => {
    if (!content.trim()) return [];
    return allContents.filter(c =>
      c.toLowerCase().includes(content.toLowerCase()) &&
      c.toLowerCase() !== content.toLowerCase()
    ).slice(0, 5);
  }, [content, allContents]);

  const handleAdd = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setLoading(true);
    try {
      const { data: newItem, error } = await supabase
        .from('items')
        .insert([{
          category_id: categoryId,
          content: trimmedContent,
          date,
        }])
        .select()
        .single();

      if (error) throw error;

      // Navigate back passing the new item for optimistic update
      navigation.navigate('Day', {
        date,
        newItem: newItem,
        newItemCategoryId: categoryId,
      });
    } catch (error: any) {
      console.error('Error adding entry:', error);
      Alert.alert('Error', error.message || 'Could not add entry');
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Add Entry</Text>
          <Text style={styles.headerSubtitle}>{categoryTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.label}>What did you achieve?</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Describe your progress..."
            value={content}
            onChangeText={setContent}
            autoFocus
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            <Text style={styles.suggestionHeader}>Previous entries</Text>
            {suggestions.map((item, index) => (
              <Pressable
                key={index}
                style={styles.suggestionItem}
                onPress={() => setContent(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.addBtn, (!content.trim() || loading) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!content.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.addBtnText}>Save Entry</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
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
  backBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  multilineInput: {
    minHeight: 120,
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
  suggestionText: {
    fontSize: 15,
    color: '#333',
  },
  addBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  addBtnDisabled: {
    backgroundColor: '#CCC',
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

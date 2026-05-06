import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function AddCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { date, slot } = route.params;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(true);

  useEffect(() => {
    async function fetchAllCategories() {
      try {
        const { data } = await supabase
          .from('categories')
          .select('title')
          .eq('slot', slot);
        
        const uniqueTitles = Array.from(new Set(data?.map(c => c.title) || []));
        setAllCategories(uniqueTitles);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setFetchingSuggestions(false);
      }
    }
    fetchAllCategories();
  }, [slot]);

  const suggestions = useMemo(() => {
    if (!title.trim()) return [];
    return allCategories.filter(t => 
      t.toLowerCase().includes(title.toLowerCase()) && 
      t.toLowerCase() !== title.toLowerCase()
    ).slice(0, 5);
  }, [title, allCategories]);

  const handleAdd = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setLoading(true);
    try {
      const { data: newCat, error } = await supabase
        .from('categories')
        .insert([{
          slot,
          date,
          title: trimmedTitle
        }])
        .select()
        .single();

      if (error) throw error;

      // Navigate back with the new category for optimistic update
      navigation.navigate('Day', { 
        date, 
        newCategory: newCat 
      });
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
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

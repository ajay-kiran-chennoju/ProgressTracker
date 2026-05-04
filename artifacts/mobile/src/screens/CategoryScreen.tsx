import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Trash2, Plus, Calendar, Clock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { format, parseISO } from 'date-fns';

export default function CategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();
  const { categoryId, title } = route.params;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [newItemContent, setNewItemContent] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allItemContents, setAllItemContents] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch items across ALL categories with the same title for this user
      // Requirement 11: select items where title = selectedCategory and participant_id = currentUserId
      
      const { data: itemData, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories!inner(*)
        `)
        .eq('category.title', title)
        .eq('category.slot', user?.slot)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(itemData);

      // Fetch all unique item contents for this category title to provide suggestions
      const uniqueContents = Array.from(new Set(itemData.map(i => i.content)));
      setAllItemContents(uniqueContents);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [title, user?.slot]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = async () => {
    const content = newItemContent.trim();
    if (!content || !user) return;

    // Duplicate Check: Check if this item exists in the current session's category
    const exists = items.some(i => i.content.toLowerCase() === content.toLowerCase() && i.category_id === categoryId);
    if (exists) {
      Alert.alert('Already exists', 'This item was already added to this category.');
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('items')
        .insert([{
          category_id: categoryId,
          content: content,
          date: format(new Date(), 'yyyy-MM-dd')
        }]);

      if (error) throw error;

      setNewItemContent('');
      setSuggestions([]);
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await supabase.from('items').delete().eq('id', id);
            fetchItems();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Showing all history</Text>
          </View>

          <View style={styles.inputSection}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="What did you achieve?"
                value={newItemContent}
                onChangeText={(text) => {
                  setNewItemContent(text);
                  const filtered = allItemContents.filter(c => 
                    c.toLowerCase().includes(text.toLowerCase()) && c.toLowerCase() !== text.toLowerCase()
                  );
                  setSuggestions(text ? filtered.slice(0, 5) : []);
                }}
                multiline
              />
              <Pressable 
                style={[styles.addIconBtn, (!newItemContent.trim() || isAdding) && styles.addIconBtnDisabled]} 
                onPress={handleAddItem}
                disabled={!newItemContent.trim() || isAdding}
              >
                {isAdding ? <ActivityIndicator size="small" color="#FFF" /> : <Plus size={24} color="#FFF" />}
              </Pressable>
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((s, i) => (
                  <Pressable 
                    key={i} 
                    style={styles.suggestionItem}
                    onPress={() => {
                      setNewItemContent(s);
                      setSuggestions([]);
                    }}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.itemsList}>
              {items.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemContent}>{item.content}</Text>
                    <Pressable onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                      <Trash2 size={16} color="#FF3B30" opacity={0.5} />
                    </Pressable>
                  </View>
                  <View style={styles.itemFooter}>
                    <View style={styles.footerTag}>
                      <Calendar size={12} color="#666" />
                      <Text style={styles.footerText}>{format(parseISO(item.category.date), 'MMM d, yyyy')}</Text>
                    </View>
                    <View style={styles.footerTag}>
                      <Clock size={12} color="#666" />
                      <Text style={styles.footerText}>{format(parseISO(item.created_at), 'h:mm a')}</Text>
                    </View>
                  </View>
                </View>
              ))}
              
              {items.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No items in this category history</Text>
                </View>
              )}
            </View>
          )}
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
  headerInfo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 24,
    zIndex: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#1A1A1A',
  },
  addIconBtn: {
    backgroundColor: '#000',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addIconBtnDisabled: {
    backgroundColor: '#CCC',
  },
  suggestionBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemContent: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 22,
    paddingRight: 10,
  },
  deleteBtn: {
    padding: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  footerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyStateText: {
    color: '#999',
    fontSize: 14,
  },
});

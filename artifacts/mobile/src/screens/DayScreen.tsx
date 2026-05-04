import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, FolderPlus, Trash2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { format, addDays, subDays, parseISO } from 'date-fns';

export default function DayScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();
  const [date, setDate] = useState(route.params?.date || format(new Date(), 'yyyy-MM-dd'));
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>(user?.slot || 'A');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ A: [], B: [] });
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allCategoryTitles, setAllCategoryTitles] = useState<string[]>([]);

  const fetchDayData = useCallback(async (selectedDate: string) => {
    setLoading(true);
    try {
      console.log(`[Day] Fetching data for date: ${selectedDate}`);
      
      // 1. Fetch Items for the date (Requirement 3 logic)
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });

      if (itemError) throw itemError;

      const catIdsWithItems = Array.from(new Set(itemData?.map(i => i.category_id) || []));

      // 2. Fetch Categories (Requirement 3 logic)
      // Filter: category.date == selectedDate OR id IN catIdsWithItems
      let catQuery = supabase
        .from('categories')
        .select('*')
        .or(`date.eq.${selectedDate}${catIdsWithItems.length > 0 ? `,id.in.(${catIdsWithItems.join(',')})` : ''}`);

      const { data: catData, error: catError } = await catQuery;
      if (catError) throw catError;

      console.log(`[Day] Items count: ${itemData?.length || 0}, Categories count: ${catData?.length || 0}`);

      // 3. Map Items to Categories
      const itemsByCat = new Map();
      itemData?.forEach(item => {
        if (!itemsByCat.has(item.category_id)) itemsByCat.set(item.category_id, []);
        itemsByCat.get(item.category_id).push(item);
      });

      const processedCats = catData?.map(cat => ({
        ...cat,
        items: itemsByCat.get(cat.id) || []
      })) || [];

      const grouped = {
        A: processedCats.filter(c => c.slot === 'A'),
        B: processedCats.filter(c => c.slot === 'B')
      };
      setData(grouped);

      // 4. Fetch all unique category titles for suggestions
      const { data: allCats } = await supabase
        .from('categories')
        .select('title')
        .eq('slot', activeSlot);
      
      const uniqueTitles = Array.from(new Set(allCats?.map(c => c.title) || []));
      setAllCategoryTitles(uniqueTitles);

    } catch (error) {
      console.error('Error fetching day data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeSlot]);

  useEffect(() => {
    fetchDayData(date);
  }, [date, fetchDayData]);

  const changeDate = (days: number) => {
    const newDate = format(addDays(parseISO(date), days), 'yyyy-MM-dd');
    setDate(newDate);
  };

  const handleAddCategory = async () => {
    const title = newCategoryTitle.trim();
    if (!title) return;

    // Duplicate Check (case-insensitive)
    const exists = data[activeSlot].some((c: any) => c.title.toLowerCase() === title.toLowerCase());
    if (exists) {
      Alert.alert('Already exists', 'This category already exists for today.');
      return;
    }

    try {
      const { data: newCat, error } = await supabase
        .from('categories')
        .insert([{
          slot: activeSlot,
          date: date,
          title: title
        }])
        .select()
        .single();

      if (error) throw error;

      setIsAddModalVisible(false);
      setNewCategoryTitle('');
      fetchDayData(date);
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category and all its items?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await supabase.from('categories').delete().eq('id', id);
            fetchDayData(date);
          }
        }
      ]
    );
  };

  const renderCategory = (cat: any) => (
    <Pressable 
      key={cat.id} 
      style={styles.categoryCard}
      onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.title })}
    >
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>{cat.title}</Text>
        <Pressable onPress={() => handleDeleteCategory(cat.id)}>
          <Trash2 size={16} color="#FF3B30" opacity={0.6} />
        </Pressable>
      </View>
      <View style={styles.itemsList}>
        {cat.items.length === 0 ? (
          <Text style={styles.noItemsText}>No entries yet</Text>
        ) : (
          cat.items.slice(0, 3).map((item: any) => (
            <Text key={item.id} style={styles.itemPreview} numberOfLines={1}>
              • {item.content}
            </Text>
          ))
        )}
        {cat.items.length > 3 && (
          <Text style={styles.moreItemsText}>+ {cat.items.length - 3} more</Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.dateHeader}>
        <Pressable onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
          <ChevronLeft size={24} color="#000" />
        </Pressable>
        <Text style={styles.dateText}>{format(parseISO(date), 'EEEE, MMM d')}</Text>
        <Pressable onPress={() => changeDate(1)} style={styles.dateNavBtn}>
          <ChevronRight size={24} color="#000" />
        </Pressable>
      </View>

      <View style={styles.slotPicker}>
        <Pressable 
          style={[styles.slotBtn, activeSlot === 'A' && styles.slotBtnActive]}
          onPress={() => setActiveSlot('A')}
        >
          <Text style={[styles.slotBtnText, activeSlot === 'A' && styles.slotBtnTextActive]}>Participant A</Text>
        </Pressable>
        <Pressable 
          style={[styles.slotBtn, activeSlot === 'B' && styles.slotBtnActive]}
          onPress={() => setActiveSlot('B')}
        >
          <Text style={[styles.slotBtnText, activeSlot === 'B' && styles.slotBtnTextActive]}>Participant B</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        ) : (
          <>
            {data[activeSlot].map(renderCategory)}
            
            {activeSlot === user?.slot && (
              <Pressable style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
                <Plus size={20} color="#666" />
                <Text style={styles.addBtnText}>Add Category</Text>
              </Pressable>
            )}
            
            {data[activeSlot].length === 0 && !loading && (
              <View style={styles.emptyState}>
                <FolderPlus size={48} color="#EEE" />
                <Text style={styles.emptyStateText}>No categories for this day</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Coding, Fitness, Reading"
              value={newCategoryTitle}
              onChangeText={(text) => {
                setNewCategoryTitle(text);
                const filtered = allCategoryTitles.filter(t => 
                  t.toLowerCase().includes(text.toLowerCase()) && t.toLowerCase() !== text.toLowerCase()
                );
                setSuggestions(text ? filtered.slice(0, 5) : []);
              }}
              autoFocus
            />
            
            {suggestions.length > 0 && (
              <View style={styles.suggestionContainer}>
                {suggestions.map((s, i) => (
                  <Pressable 
                    key={i} 
                    style={styles.suggestionItem}
                    onPress={() => {
                      setNewCategoryTitle(s);
                      setSuggestions([]);
                    }}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtnAdd} onPress={handleAddCategory}>
                <Text style={styles.modalBtnAddText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  dateNavBtn: {
    padding: 5,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  slotPicker: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  slotBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  slotBtnActive: {
    backgroundColor: '#000',
  },
  slotBtnText: {
    color: '#666',
    fontWeight: '500',
  },
  slotBtnTextActive: {
    color: '#FFF',
  },
  scrollContent: {
    padding: 15,
  },
  categoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  itemsList: {
    marginTop: 5,
  },
  noItemsText: {
    fontStyle: 'italic',
    color: '#999',
    fontSize: 13,
  },
  itemPreview: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderColor: '#EEE',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 5,
  },
  addBtnText: {
    marginLeft: 8,
    color: '#666',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyStateText: {
    marginTop: 10,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  suggestionContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtnCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  modalBtnCancelText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalBtnAdd: {
    flex: 1,
    backgroundColor: '#000',
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalBtnAddText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

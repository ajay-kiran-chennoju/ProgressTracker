import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, FolderPlus, Trash2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { format, addDays, parseISO } from 'date-fns';

// ─── Memoized CategoryCard ────────────────────────────────────────────────────
const CategoryCard = memo(({ cat, activeSlot, userSlot, onAddEntry, onDeleteCategory, onNavigate }: any) => (
  <Pressable
    style={styles.categoryCard}
    onPress={() => onNavigate(cat.id, cat.title)}
  >
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryTitle}>{cat.title}</Text>
      <Pressable
        hitSlop={8}
        onPress={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
      >
        <Trash2 size={16} color="#FF3B30" opacity={0.6} />
      </Pressable>
    </View>

    <View style={styles.itemsList}>
      {(cat.items || []).length === 0 ? (
        <Text style={styles.noItemsText}>No entries yet</Text>
      ) : (
        cat.items.map((item: any) => (
          <Text key={item.id} style={styles.itemPreview} numberOfLines={2}>
            • {item.content}
          </Text>
        ))
      )}
    </View>

    {activeSlot === userSlot && (
      <Pressable
        style={styles.addItemInlineBtn}
        onPress={(e) => { e.stopPropagation(); onAddEntry(cat.id, cat.title); }}
      >
        <Plus size={14} color="#007AFF" />
        <Text style={styles.addItemInlineText}>Add entry</Text>
      </Pressable>
    )}
  </Pressable>
));

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DayScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();

  const [date, setDate] = useState(route.params?.date || format(new Date(), 'yyyy-MM-dd'));
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>(user?.slot || 'A');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ A: [], B: [] });
  const [participants, setParticipants] = useState<any>({ A: null, B: null });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDayData = useCallback(async (selectedDate: string) => {
    setLoading(true);
    try {
      // Participants
      const { data: partData } = await supabase.from('participants').select('slot, name');
      const partMap: any = { A: null, B: null };
      partData?.forEach(p => { partMap[p.slot] = p; });
      setParticipants(partMap);

      // Items for this date
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });
      if (itemError) throw itemError;

      const catIdsWithItems = Array.from(new Set(itemData?.map(i => i.category_id) || []));

      // Categories for this date (or that have items on this date)
      const orFilter = `date.eq.${selectedDate}${catIdsWithItems.length > 0 ? `,id.in.(${catIdsWithItems.join(',')})` : ''}`;
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .or(orFilter);
      if (catError) throw catError;

      // Map items → categories
      const itemsByCat = new Map<string, any[]>();
      itemData?.forEach(item => {
        if (!itemsByCat.has(item.category_id)) itemsByCat.set(item.category_id, []);
        itemsByCat.get(item.category_id)!.push(item);
      });

      const processed = catData?.map(cat => ({
        ...cat,
        items: itemsByCat.get(cat.id) || []
      })) || [];

      setData({
        A: processed.filter(c => c.slot === 'A'),
        B: processed.filter(c => c.slot === 'B'),
      });
    } catch (err) {
      console.error('Error fetching day data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDayData(date);
  }, [date, fetchDayData]);

  // ── Handle return from AddCategoryScreen / AddEntryScreen ──────────────────
  useFocusEffect(
    useCallback(() => {
      const params = route.params as any;
      if (!params) return;

      // New category came back
      if (params.newCategory) {
        const cat = params.newCategory;
        setData((prev: any) => ({
          ...prev,
          [cat.slot]: prev[cat.slot].some((c: any) => c.id === cat.id)
            ? prev[cat.slot]
            : [...prev[cat.slot], { ...cat, items: [] }],
        }));
        navigation.setParams({ newCategory: undefined });
      }

      // New item came back
      if (params.newItem && params.newItemCategoryId) {
        const item = params.newItem;
        const catId = params.newItemCategoryId;
        setData((prev: any) => ({
          A: prev.A.map((cat: any) =>
            cat.id === catId
              ? { ...cat, items: cat.items.some((i: any) => i.id === item.id) ? cat.items : [...cat.items, item] }
              : cat
          ),
          B: prev.B.map((cat: any) =>
            cat.id === catId
              ? { ...cat, items: cat.items.some((i: any) => i.id === item.id) ? cat.items : [...cat.items, item] }
              : cat
          ),
        }));
        navigation.setParams({ newItem: undefined, newItemCategoryId: undefined });
      }
    }, [route.params])
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const changeDate = useCallback((days: number) => {
    setDate(prev => format(addDays(parseISO(prev), days), 'yyyy-MM-dd'));
  }, []);

  const handleDeleteCategory = useCallback((id: string) => {
    Alert.alert(
      'Delete Category',
      'Delete this category and all its entries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setData((prev: any) => ({
              ...prev,
              [activeSlot]: prev[activeSlot].filter((c: any) => c.id !== id)
            }));
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) {
              console.error('Delete failed, re-fetching:', error);
              fetchDayData(date);
            }
          }
        }
      ]
    );
  }, [activeSlot, date, fetchDayData]);

  const handleAddEntry = useCallback((categoryId: string, categoryTitle: string) => {
    navigation.navigate('AddEntry', { categoryId, categoryTitle, date });
  }, [navigation, date]);

  const navigateToCategory = useCallback((id: string, title: string) => {
    navigation.navigate('Category', { categoryId: id, title });
  }, [navigation]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Date header */}
      <View style={styles.dateHeader}>
        <Pressable onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
          <ChevronLeft size={24} color="#000" />
        </Pressable>
        <Text style={styles.dateText}>{format(parseISO(date), 'EEEE, MMM d')}</Text>
        <Pressable onPress={() => changeDate(1)} style={styles.dateNavBtn}>
          <ChevronRight size={24} color="#000" />
        </Pressable>
      </View>

      {/* Slot picker with real names */}
      <View style={styles.slotPicker}>
        {(['A', 'B'] as const).map(slot => (
          <Pressable
            key={slot}
            style={[styles.slotBtn, activeSlot === slot && styles.slotBtnActive]}
            onPress={() => setActiveSlot(slot)}
          >
            <Text style={[styles.slotBtnText, activeSlot === slot && styles.slotBtnTextActive]}>
              {participants[slot]?.name || `Participant ${slot}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Category list */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        ) : (
          <>
            {data[activeSlot].map((cat: any) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                activeSlot={activeSlot}
                userSlot={user?.slot}
                onAddEntry={handleAddEntry}
                onDeleteCategory={handleDeleteCategory}
                onNavigate={navigateToCategory}
              />
            ))}

            {activeSlot === user?.slot && (
              <Pressable
                style={styles.addCategoryBtn}
                onPress={() => navigation.navigate('AddCategory', { date, slot: activeSlot })}
              >
                <Plus size={20} color="#666" />
                <Text style={styles.addCategoryBtnText}>Add Category</Text>
              </Pressable>
            )}

            {data[activeSlot].length === 0 && (
              <View style={styles.emptyState}>
                <FolderPlus size={48} color="#DDD" />
                <Text style={styles.emptyStateText}>No categories for this day</Text>
                <Text style={styles.emptyStateSubtext}>Tap "Add Category" to get started</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
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
  dateNavBtn: { padding: 5 },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  slotPicker: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFF',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  slotBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  slotBtnActive: { backgroundColor: '#000' },
  slotBtnText: { color: '#666', fontWeight: '500' },
  slotBtnTextActive: { color: '#FFF' },
  scrollContent: { padding: 15, paddingBottom: 40 },
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
  categoryTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', flex: 1 },
  itemsList: { marginTop: 5 },
  noItemsText: { fontStyle: 'italic', color: '#999', fontSize: 13 },
  itemPreview: { fontSize: 14, color: '#444', marginBottom: 6, lineHeight: 20 },
  addItemInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  addItemInlineText: { marginLeft: 6, color: '#007AFF', fontSize: 14, fontWeight: '500' },
  addCategoryBtn: {
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
  addCategoryBtnText: { marginLeft: 8, color: '#666', fontWeight: '500' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyStateText: { marginTop: 12, color: '#999', fontSize: 16, fontWeight: '600' },
  emptyStateSubtext: { marginTop: 6, color: '#BBB', fontSize: 13 },
});

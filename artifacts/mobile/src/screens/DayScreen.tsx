import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, FolderPlus, Trash2, Home, ClipboardList, Square } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { safeDeleteCategory } from '../lib/dbSafeHelpers';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../lib/theme';
import { registerNavCallback } from '../lib/navigationCallbacks';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { completeTask } from '../lib/taskHelpers';

// ─── Memoized CategoryCard ────────────────────────────────────────────────────

const CategoryCard = memo(({
  cat, activeSlot, userSlot, colors,
  onAddEntry, onAddTask, onDeleteCategory, onNavigate, onCompleteTask,
}: any) => (
  <Pressable style={[cardStyles.card, { backgroundColor: colors.surface }]} onPress={() => onNavigate(cat.id, cat.title)}>
    {/* Header row */}
    <View style={cardStyles.header}>
      <Text style={[cardStyles.title, { color: colors.text }]}>{cat.title}</Text>
      <Pressable hitSlop={8} onPress={e => { e.stopPropagation(); onDeleteCategory(cat.id); }}>
        <Trash2 size={16} color={colors.danger} opacity={0.6} />
      </Pressable>
    </View>

    {/* Items & Tasks preview */}
    <View style={cardStyles.itemsList}>
      {/* Tasks first (Pending) */}
      {(cat.tasks || []).map((task: any) => (
        <View key={task.id} style={cardStyles.taskPreviewRow}>
          {activeSlot === userSlot ? (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onCompleteTask(task); }}
              hitSlop={8}
              style={cardStyles.checkbox}
            >
              <Square size={18} color={colors.primary} />
            </Pressable>
          ) : (
            <Square size={14} color={colors.border} style={{ marginTop: 4 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[cardStyles.itemPreview, { color: colors.textSecondary, fontStyle: 'italic' }]} numberOfLines={2}>
              {task.content}
            </Text>

          </View>
        </View>
      ))}

      {/* Normal Entries */}
      {(cat.items || []).map((item: any) => (
        <Text key={item.id} style={[cardStyles.itemPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          • {item.content}
        </Text>
      ))}

      {(cat.items || []).length === 0 && (cat.tasks || []).length === 0 && (
        <Text style={[cardStyles.noItemsText, { color: colors.textSecondary }]}>No entries yet</Text>
      )}
    </View>

    {/* Action buttons — only for your own slot */}
    {activeSlot === userSlot && (
      <View style={[cardStyles.actionsRow, { borderTopColor: colors.border }]}>
        <Pressable
          style={cardStyles.actionBtn}
          onPress={e => { e.stopPropagation(); onAddEntry(cat.id, cat.title); }}
        >
          <Plus size={13} color={colors.primary} />
          <Text style={[cardStyles.actionBtnText, { color: colors.primary }]}>Add entry</Text>
        </Pressable>
        <View style={[cardStyles.actionDivider, { backgroundColor: colors.border }]} />
        <Pressable
          style={cardStyles.actionBtn}
          onPress={e => { e.stopPropagation(); onAddTask(cat.id, cat.title); }}
        >
          <ClipboardList size={13} color={colors.accent} />
          <Text style={[cardStyles.actionBtnText, { color: colors.accent }]}>Add task</Text>
        </Pressable>
      </View>
    )}
  </Pressable>
));

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 12, padding: 15, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  itemsList: { marginTop: 5 },
  noItemsText: { fontStyle: 'italic', fontSize: 13 },
  taskPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  checkbox: { marginTop: 2 },

  itemPreview: { fontSize: 14, marginBottom: 6, lineHeight: 20 },
  actionsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1,
  },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 2 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  actionDivider: { width: 1, height: 18, marginHorizontal: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DayScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();
  const { colors } = useTheme();

  const [date, setDate] = useState(route.params?.date || format(new Date(), 'yyyy-MM-dd'));
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>(user?.slot || 'A');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ A: [], B: [] });
  const [participants, setParticipants] = useState<any>({ A: null, B: null });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDayData = useCallback(async (selectedDate: string) => {
    setLoading(true);
    try {


      const { data: partData } = await supabase.from('participants').select('slot, name');
      const partMap: any = { A: null, B: null };
      partData?.forEach(p => { partMap[p.slot] = p; });
      setParticipants(partMap);

      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('date', selectedDate)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (itemError) throw itemError;

      // Also fetch tasks for this day
      const nextDate = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
      const { data: taskData, error: taskError } = await supabase
        .from('tasks_v2')
        .select('*')
        .lte('added_date', selectedDate)
        .eq('is_deleted', false)
        .or(`completed_at.is.null,and(completed_at.gte.${selectedDate}T00:00:00.000Z,completed_at.lt.${nextDate}T00:00:00.000Z)`)
        .order('id', { ascending: true });
      if (taskError) throw taskError;

      const catIdsWithItems = Array.from(new Set(itemData?.map(i => i.category_id) || []));
      const catIdsWithTasks = Array.from(new Set(taskData?.map(t => t.category_id) || []));
      const allActiveCatIds = Array.from(new Set([...catIdsWithItems, ...catIdsWithTasks]));

      const orFilter = `date.eq.${selectedDate}${allActiveCatIds.length > 0 ? `,id.in.(${allActiveCatIds.join(',')})` : ''}`;

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .or(orFilter)
        .eq('is_deleted', false);
      if (catError) throw catError;

      const itemsByCat = new Map<string, any[]>();
      itemData?.forEach(item => {
        if (!itemsByCat.has(item.category_id)) itemsByCat.set(item.category_id, []);
        itemsByCat.get(item.category_id)!.push(item);
      });

      const tasksByCat = new Map<string, any[]>();
      const seenTasks = new Set<string>();

      taskData?.forEach(task => {
        const contentKey = `${task.category_id}:::${task.content.trim().toLowerCase()}`;
        if (seenTasks.has(contentKey)) return;

        // SAFETY: If an item with the same content already exists today for this category, skip the task
        const itemsToday = itemsByCat.get(task.category_id) || [];
        const isAlreadyDone = itemsToday.some(i => i.content.trim().toLowerCase() === task.content.trim().toLowerCase());
        if (isAlreadyDone) return;

        if (!tasksByCat.has(task.category_id)) tasksByCat.set(task.category_id, []);
        tasksByCat.get(task.category_id)!.push(task);
        seenTasks.add(contentKey);
      });

      const processed = catData?.map(cat => ({
        ...cat,
        items: itemsByCat.get(cat.id) || [],
        tasks: tasksByCat.get(cat.id) || [],
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
  }, [activeSlot, user?.slot]);

  useEffect(() => { fetchDayData(date); }, [date, fetchDayData]);
  useFocusEffect(useCallback(() => { fetchDayData(date); }, [date, fetchDayData]));

  // ── Actions ────────────────────────────────────────────────────────────────

  const changeDate = useCallback((days: number) => {
    setDate((prev: string) => format(addDays(parseISO(prev), days), 'yyyy-MM-dd'));
  }, []);

  const handleDeleteCategory = useCallback((id: string) => {
    Alert.alert('Delete Category', 'Delete this category and all its entries for this day?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setData((prev: any) => ({
            ...prev,
            [activeSlot]: prev[activeSlot].filter((c: any) => c.id !== id),
          }));
          try {
            await safeDeleteCategory(id, activeSlot);
          } catch (err) {
            console.error('[SAFE DELETE] failed:', err);
            fetchDayData(date);
          }
        },
      },
    ]);
  }, [activeSlot, date, fetchDayData]);

  // AddEntry — callback-based: no navigate('Day'), no stack growth
  const handleAddEntry = useCallback((categoryId: string, categoryTitle: string) => {
    const callbackKey = registerNavCallback((newItem: any, catId: string) => {
      setData((prev: any) => ({
        A: prev.A.map((cat: any) =>
          cat.id === catId
            ? { ...cat, items: cat.items.some((i: any) => i.id === newItem.id) ? cat.items : [...cat.items, newItem] }
            : cat,
        ),
        B: prev.B.map((cat: any) =>
          cat.id === catId
            ? { ...cat, items: cat.items.some((i: any) => i.id === newItem.id) ? cat.items : [...cat.items, newItem] }
            : cat,
        ),
      }));
    });
    navigation.navigate('AddEntry', { categoryId, categoryTitle, date, callbackKey });
  }, [navigation, date]);

  // AddTask — callback-based
  const handleAddTask = useCallback((categoryId: string, categoryTitle: string) => {
    const callbackKey = registerNavCallback((_newTask: any) => {
      fetchDayData(date);
    });
    navigation.navigate('AddTask', { categoryId, categoryTitle, date, callbackKey });
  }, [navigation, date, fetchDayData]);

  const handleCompleteTask = useCallback(async (task: any) => {
    // Optimistic update
    setData((prev: any) => {
      const slot = activeSlot;
      return {
        ...prev,
        [slot]: prev[slot].map((cat: any) => {
          if (cat.id === task.category_id) {
            return {
              ...cat,
              tasks: cat.tasks.filter((t: any) => t.id !== task.id),
              items: [{ ...task, id: `temp-${Date.now()}` }, ...cat.items],
            };
          }
          return cat;
        }),
      };
    });

    try {
      await completeTask(task);
    } catch (err) {
      console.error('Error completing task:', err);
      fetchDayData(date);
    }
  }, [activeSlot, date, fetchDayData]);

  // AddCategory — callback-based
  const handleAddCategory = useCallback(() => {
    const callbackKey = registerNavCallback((newCat: any) => {
      setActiveSlot(newCat.slot);
      setData((prev: any) => ({
        ...prev,
        [newCat.slot]: prev[newCat.slot].some((c: any) => c.id === newCat.id)
          ? prev[newCat.slot]
          : [...prev[newCat.slot], { ...newCat, items: [] }],
      }));
    });
    navigation.navigate('AddCategory', { date, slot: activeSlot, callbackKey });
  }, [navigation, date, activeSlot]);

  const navigateToCategory = useCallback((id: string, title: string) => {
    navigation.navigate('Category', { categoryId: id, title });
  }, [navigation]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Date header */}
      <View style={[styles.dateHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.popToTop()} style={styles.homeBtn}>
          <Home size={22} color={colors.text} />
        </Pressable>
        <View style={styles.dateNavigator}>
          <Pressable onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
            <ChevronLeft size={20} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {format(parseISO(date), 'EEEE, MMM d')}
          </Text>
          <Pressable onPress={() => changeDate(1)} style={styles.dateNavBtn}>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Slot picker */}
      <View style={[styles.slotPicker, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['A', 'B'] as const).map(slot => (
          <Pressable
            key={slot}
            style={[styles.slotBtn, activeSlot === slot && { backgroundColor: colors.primary }]}
            onPress={() => setActiveSlot(slot)}
          >
            <Text style={[styles.slotBtnText, { color: activeSlot === slot ? '#FFF' : colors.textSecondary }]}>
              {participants[slot]?.name || `Participant ${slot}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Category list */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {data[activeSlot].map((cat: any) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                activeSlot={activeSlot}
                userSlot={user?.slot}
                colors={colors}
                onAddEntry={handleAddEntry}
                onAddTask={handleAddTask}
                onDeleteCategory={handleDeleteCategory}
                onNavigate={navigateToCategory}
                onCompleteTask={handleCompleteTask}
              />
            ))}

            {activeSlot === user?.slot && (
              <Pressable style={[styles.addCategoryBtn, { borderColor: colors.border }]} onPress={handleAddCategory}>
                <Plus size={20} color={colors.textSecondary} />
                <Text style={[styles.addCategoryBtnText, { color: colors.textSecondary }]}>Add Category</Text>
              </Pressable>
            )}

            {data[activeSlot].length === 0 && (
              <View style={styles.emptyState}>
                <FolderPlus size={48} color={colors.border} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No categories for this day</Text>
                <Text style={[styles.emptyStateSubtext, { color: colors.border }]}>Tap "Add Category" to get started</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  homeBtn: { padding: 8, marginRight: 4 },
  dateNavigator: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dateNavBtn: { padding: 8 },
  dateText: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 10 },
  slotPicker: {
    flexDirection: 'row', padding: 10,
    borderBottomWidth: 1,
  },
  slotBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
  slotBtnText: { fontWeight: '500' },
  scrollContent: { padding: 15, paddingBottom: 40 },
  addCategoryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, marginTop: 5,
  },
  addCategoryBtnText: { marginLeft: 8, fontWeight: '500' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyStateText: { marginTop: 12, fontSize: 16, fontWeight: '600' },
  emptyStateSubtext: { marginTop: 6, fontSize: 13 },
});

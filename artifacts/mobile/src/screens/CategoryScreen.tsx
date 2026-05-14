/**
 * CategoryScreen.tsx
 *
 * Shows:
 *  1. Pending Tasks section (top) — with checkbox completion & carry-forward badge
 *  2. Completed Entries / History (below)
 */

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Trash2, Plus, Calendar, Clock, Square, ClipboardList } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import {
  safeFetchItemsByCategoryId,
  safeFetchItemContentSuggestions,
  safeDeleteItem,
} from '../lib/dbSafeHelpers';
import {
  fetchPendingTasksForCategory,
  completeTask,
  softDeleteTask,
  SafeTask,
} from '../lib/taskHelpers';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../lib/theme';
import { format, parseISO } from 'date-fns';

// ─── Task Row ─────────────────────────────────────────────────────────────────

const TaskRow = memo(({ task, colors, onComplete, onDelete }: {
  task: SafeTask; colors: any;
  onComplete: (task: SafeTask) => void;
  onDelete: (id: string) => void;
}) => {
  const [completing, setCompleting] = useState(false);
  const handleComplete = async () => {
    setCompleting(true);
    await onComplete(task);
    setCompleting(false);
  };
  return (
    <View style={[tStyles.row, { backgroundColor: colors.taskBg, borderColor: colors.taskBorder }]}>
      <Pressable onPress={handleComplete} disabled={completing} style={tStyles.checkbox} hitSlop={8}>
        {completing
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Square size={22} color={colors.primary} />}
      </Pressable>
      <View style={tStyles.textArea}>
        <Text style={[tStyles.content, { color: colors.text }]}>{task.content}</Text>
        {task.carried_forward_from && (
          <View style={[tStyles.badge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[tStyles.badgeText, { color: colors.primary }]}>
              📅 from {format(parseISO(task.carried_forward_from), 'MMM d')}
            </Text>
          </View>
        )}
      </View>
      <Pressable onPress={() => onDelete(task.id)} hitSlop={8} style={tStyles.del}>
        <Trash2 size={14} color={colors.danger} opacity={0.5} />
      </Pressable>
    </View>
  );
});

const tStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 14, borderWidth: 1, marginBottom: 8 },
  checkbox: { marginRight: 12, paddingTop: 1 },
  textArea: { flex: 1 },
  content: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  del: { paddingLeft: 8, paddingTop: 2 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();
  const { colors } = useTheme();
  const { categoryId, title } = route.params;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<SafeTask[]>([]);
  const [newContent, setNewContent] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allContents, setAllContents] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemData, uniqueC, pendingTasks] = await Promise.all([
        safeFetchItemsByCategoryId(categoryId),
        safeFetchItemContentSuggestions(categoryId),
        fetchPendingTasksForCategory(categoryId, today),
      ]);
      setItems(itemData);
      setAllContents(uniqueC);
      setTasks(pendingTasks);
    } catch (e) { console.error('Fetch error:', e); }
    finally { setLoading(false); }
  }, [categoryId, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Receive new task from AddTaskScreen
  useFocusEffect(useCallback(() => {
    const p = route.params as any;
    if (p?.newTask) {
      const t = p.newTask;
      setTasks(prev => prev.some(x => x.id === t.id) ? prev : [t, ...prev]);
      navigation.setParams({ newTask: undefined });
    }
  }, [route.params]));

  const handleCompleteTask = useCallback(async (task: SafeTask) => {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      const newItem = await completeTask(task);
      setItems(prev => prev.some(i => i.id === newItem.id) ? prev : [newItem, ...prev]);
    } catch (e) { console.error(e); setTasks(prev => [task, ...prev]); }
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    Alert.alert('Delete Task', 'Delete this pending task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setTasks(prev => prev.filter(t => t.id !== id));
        await softDeleteTask(id).catch(fetchAll);
      }},
    ]);
  }, [fetchAll]);

  const handleAddItem = async () => {
    const content = newContent.trim();
    if (!content || !user) return;
    const exists = items.some(i => i.content.toLowerCase() === content.toLowerCase());
    if (exists) { Alert.alert('Already exists', 'This item was already added.'); return; }
    setIsAdding(true);
    try {
      const { data: newItem, error } = await supabase
        .from('items').insert([{ category_id: categoryId, content, date: today }])
        .select().single();
      if (error) throw error;
      setItems(prev => [newItem, ...prev]);
      setNewContent(''); setSuggestions([]);
    } catch (e) { console.error(e); }
    finally { setIsAdding(false); }
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert('Delete Item', 'Delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setItems(prev => prev.filter(i => i.id !== id));
        await safeDeleteItem(id, user?.slot ?? '').catch(fetchAll);
      }},
    ]);
  };

  const s = useMemo(() => mkStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.headerInfo}>
            <Text style={s.titleText}>{title}</Text>
            <Text style={s.subtitle}>History & pending tasks</Text>
          </View>

          {/* Add Entry */}
          <View style={s.inputSection}>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                placeholder="What did you achieve?"
                placeholderTextColor={colors.textSecondary}
                value={newContent}
                onChangeText={text => {
                  setNewContent(text);
                  setSuggestions(text ? allContents.filter(c =>
                    c.toLowerCase().includes(text.toLowerCase()) && c.toLowerCase() !== text.toLowerCase()
                  ).slice(0, 5) : []);
                }}
                multiline
              />
              <Pressable style={[s.addIconBtn, (!newContent.trim() || isAdding) && s.addIconBtnDis]}
                onPress={handleAddItem} disabled={!newContent.trim() || isAdding}>
                {isAdding ? <ActivityIndicator size="small" color="#FFF" /> : <Plus size={24} color="#FFF" />}
              </Pressable>
            </View>
            {suggestions.length > 0 && (
              <View style={s.suggestionBox}>
                {suggestions.map((sg, i) => (
                  <Pressable key={i} style={s.suggestionItem} onPress={() => { setNewContent(sg); setSuggestions([]); }}>
                    <Text style={s.suggestionText}>{sg}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Pending Tasks */}
              <View style={s.sectionRow}>
                <View style={s.sectionTitleRow}>
                  <ClipboardList size={16} color={colors.primary} />
                  <Text style={[s.sectionTitle, { color: colors.primary }]}> Pending Tasks</Text>
                </View>
                <Pressable style={[s.addTaskBtn, { borderColor: colors.primary }]}
                  onPress={() => navigation.navigate('AddTask', { categoryId, categoryTitle: title, date: today })}>
                  <Plus size={13} color={colors.primary} />
                  <Text style={[s.addTaskBtnText, { color: colors.primary }]}>Add Task</Text>
                </Pressable>
              </View>

              {tasks.length === 0 ? (
                <View style={[s.emptyTask, { borderColor: colors.taskBorder, backgroundColor: colors.taskBg }]}>
                  <Text style={[s.emptyTaskText, { color: colors.textSecondary }]}>No pending tasks 🎉</Text>
                </View>
              ) : (
                <View>
                  {tasks.map(task => (
                    <TaskRow key={task.id} task={task} colors={colors}
                      onComplete={handleCompleteTask} onDelete={handleDeleteTask} />
                  ))}
                </View>
              )}

              {/* History */}
              <View style={[s.sectionRow, { marginTop: 24 }]}>
                <View style={s.sectionTitleRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={[s.sectionTitle, { color: colors.text }]}> History</Text>
                </View>
              </View>

              <View style={s.itemsList}>
                {items.map(item => (
                  <View key={item.id} style={[s.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={s.itemMain}>
                      <Text style={[s.itemContent, { color: colors.text }]}>{item.content}</Text>
                      <Pressable onPress={() => handleDeleteItem(item.id)} style={s.deleteBtn}>
                        <Trash2 size={16} color={colors.danger} opacity={0.5} />
                      </Pressable>
                    </View>
                    <View style={s.itemFooter}>
                      <View style={s.footerTag}>
                        <Calendar size={12} color={colors.textSecondary} />
                        <Text style={[s.footerText, { color: colors.textSecondary }]}>
                          {format(parseISO(item.category?.date ?? item.date ?? today), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      {item.created_at && (
                        <View style={s.footerTag}>
                          <Clock size={12} color={colors.textSecondary} />
                          <Text style={[s.footerText, { color: colors.textSecondary }]}>
                            {format(parseISO(item.created_at), 'h:mm a')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                {items.length === 0 && (
                  <View style={s.emptyState}>
                    <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>No history entries yet</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const mkStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20 },
  headerInfo: { marginBottom: 20 },
  titleText: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  inputSection: { marginBottom: 24, zIndex: 10 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 16, color: colors.text },
  addIconBtn: { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  addIconBtnDis: { backgroundColor: colors.border },
  suggestionBox: { backgroundColor: colors.surface, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border, elevation: 4 },
  suggestionItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { fontSize: 14, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addTaskBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 3 },
  addTaskBtnText: { fontSize: 13, fontWeight: '600' },
  emptyTask: { borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', padding: 20, alignItems: 'center' },
  emptyTaskText: { fontSize: 13 },
  itemsList: { gap: 12 },
  itemCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  itemMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemContent: { flex: 1, fontSize: 16, lineHeight: 22, paddingRight: 10 },
  deleteBtn: { padding: 4 },
  itemFooter: { flexDirection: 'row', marginTop: 12, gap: 16 },
  footerTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateText: { fontSize: 14 },
});

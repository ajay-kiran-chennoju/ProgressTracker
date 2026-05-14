import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, CheckSquare } from 'lucide-react-native';
import { format } from 'date-fns';
import { safeCreateTask, fetchTaskSuggestions } from '../lib/taskHelpers';
import { invokeNavCallback } from '../lib/navigationCallbacks';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../lib/theme';

const normalizeContent = (s: string) => s.trim().toLowerCase();

export default function AddTaskScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useCurrentUser();
  const { colors } = useTheme();
  const { categoryId, categoryTitle, date, callbackKey } = route.params;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [allContents, setAllContents] = useState<string[]>([]);

  useEffect(() => {
    fetchTaskSuggestions(categoryId)
      .then(setAllContents)
      .catch(err => console.error('Error fetching task suggestions:', err));
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
    if (!trimmed || !user) return;

    setLoading(true);
    Keyboard.dismiss();

    try {
      const task = await safeCreateTask({
        categoryId,
        slot: user.slot,
        content: trimmed,
        taskDate: date ?? format(new Date(), 'yyyy-MM-dd'),
      });

      // Fire callback → caller updates its state optimistically, then go back
      invokeNavCallback(callbackKey, task);
      navigation.goBack();
    } catch (err: any) {
      console.error('Error adding task:', err);
      Alert.alert('Error', err.message || 'Could not add task');
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
          <Text style={s.headerTitle}>Add Task</Text>
          <Text style={s.headerSubtitle}>{categoryTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.content}
      >
        <View style={s.inputContainer}>
          <Text style={s.label}>What do you need to do?</Text>
          <TextInput
            style={[s.input, s.multilineInput]}
            placeholder="Describe the task..."
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            autoFocus
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {suggestions.length > 0 && (
          <View style={s.suggestionsList}>
            <Text style={s.suggestionHeader}>Previous tasks</Text>
            {suggestions.map((item, i) => (
              <Pressable key={i} style={s.suggestionItem} onPress={() => setContent(item)}>
                <CheckSquare size={14} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={s.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.hint}>
          <Text style={s.hintText}>
            💡 Incomplete tasks carry forward automatically to the next day.
          </Text>
        </View>

        <Pressable
          style={[s.addBtn, (!content.trim() || loading) && s.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!content.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <CheckSquare size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={s.addBtnText}>Add Task</Text>
            </>
          )}
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
  multilineInput: { minHeight: 100 },
  suggestionsList: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, marginBottom: 20, overflow: 'hidden',
  },
  suggestionHeader: {
    fontSize: 12, fontWeight: 'bold', color: colors.textSecondary,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, textTransform: 'uppercase',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border,
  },
  suggestionText: { fontSize: 15, color: colors.text, flex: 1 },
  hint: {
    backgroundColor: colors.primaryLight, borderRadius: 10, padding: 14, marginBottom: 20,
  },
  hintText: { fontSize: 13, color: colors.primary, lineHeight: 18 },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    marginTop: 'auto', marginBottom: 20,
  },
  addBtnDisabled: { backgroundColor: colors.border },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

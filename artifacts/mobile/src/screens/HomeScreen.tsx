import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Folder, Settings, ChevronRight, LayoutList } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../lib/supabase';
import { safeFetchAllCategories, safeCountItemsByCategoryIds, safeFetchActiveDates } from '../lib/dbSafeHelpers';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../lib/theme';
import { RootStackParamList } from '../lib/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useCurrentUser();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [activeDatesList, setActiveDatesList] = useState<string[]>([]);
  const [otherStreak, setOtherStreak] = useState(0);
  const [otherName, setOtherName] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const safeData = await safeFetchAllCategories(user.slot);
      setAllCategories(safeData);
      const catIds = safeData.map((c: any) => c.id);
      const count = await safeCountItemsByCategoryIds(catIds);
      setTotalItems(count);
      const dates = await safeFetchActiveDates(user.slot);
      setActiveDatesList(dates);

      const otherSlot = user.slot === 'A' ? 'B' : 'A';
      const otherDates = await safeFetchActiveDates(otherSlot);
      setOtherStreak(computeStreak(otherDates));

      const { data: otherParts } = await supabase
        .from('participants').select('name').eq('slot', otherSlot).single();
      setOtherName(otherParts?.name ?? null);
    } catch (err) {
      console.error('Error fetching home data:', err);
      setAllCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    activeDatesList.forEach(dateStr => {
      marks[dateStr] = { marked: true, dotColor: colors.primary };
    });
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    marks[todayStr] = {
      ...marks[todayStr],
      selected: true,
      selectedColor: colors.primaryLight,
      selectedTextColor: colors.primary,
    };
    return marks;
  }, [activeDatesList, colors]);

  const computeStreak = (dateList: string[]): number => {
    if (!dateList.length) return 0;
    const uniqueDates = [...dateList].sort((a, b) => b.localeCompare(a));
    const parseLocalDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const today = parseLocalDate(format(new Date(), 'yyyy-MM-dd'));
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceLast = Math.round((today.getTime() - parseLocalDate(uniqueDates[0]).getTime()) / msPerDay);
    if (daysSinceLast > 1) return 0;
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = Math.round((parseLocalDate(uniqueDates[i - 1]).getTime() - parseLocalDate(uniqueDates[i]).getTime()) / msPerDay);
      if (diff === 1) streak++; else break;
    }
    return streak;
  };

  const currentStreak = useMemo(() => computeStreak(activeDatesList), [activeDatesList]);

  const uniqueCats = useMemo(() => {
    if (!allCategories.length) return [];
    const map = new Map<string, any>();
    allCategories.forEach(c => { if (c?.title) map.set(c.title.toLowerCase(), c); });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [allCategories]);

  const s = useMemo(() => mkStyles(colors), [colors]);

  if (!user) return <View style={s.loadingContainer}><Text style={{ color: colors.textSecondary }}>Please log in</Text></View>;
  if (loading && !refreshing) return <View style={s.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {user?.name || 'User'} 👋</Text>
            <Text style={s.subtitle}>Track your progress today</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Settings')}>
            <Settings size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={s.statsCard}>
          <View style={s.statItem}>
            <View style={[s.statIconContainer, { backgroundColor: '#FFF5E6' }]}>
              <Flame size={24} color="#FF9500" />
            </View>
            <View>
              <View style={s.streakRow}>
                <Text style={s.statValue}>{currentStreak}</Text>
                {currentStreak > 0 && currentStreak >= otherStreak && <Text style={s.winEmoji}>😎</Text>}
              </View>
              <Text style={s.statLabel}>Your Streak</Text>
              {otherName && (
                <View style={s.otherStreakRow}>
                  <Text style={s.otherStreakValue}>{otherStreak}</Text>
                  {otherStreak > currentStreak && <Text style={s.otherWinEmoji}>😎</Text>}
                  <Text style={s.otherStreakLabel}> {otherName}'s streak</Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <View style={[s.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <LayoutList size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={s.statValue}>{totalItems}</Text>
              <Text style={s.statLabel}>Total Entries</Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Activity Calendar</Text>
        </View>
        <View style={s.calendarCard}>
          <Calendar
            markedDates={markedDates}
            onDayPress={(day: any) => navigation.navigate('Day', { date: day.dateString })}
            theme={{
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              dotColor: colors.primary,
              selectedDotColor: colors.primary,
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* Category list */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Your Categories</Text>
        </View>
        <View style={s.categoryList}>
          {uniqueCats.map(cat => (
            <Pressable
              key={cat.id}
              style={s.categoryItem}
              onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.title })}
            >
              <View style={s.categoryInfo}>
                <Folder size={20} color={colors.primary} style={s.folderIcon} />
                <Text style={s.categoryTitle}>{cat.title}</Text>
              </View>
              <ChevronRight size={20} color={colors.border} />
            </Pressable>
          ))}
          {uniqueCats.length === 0 && (
            <Text style={s.emptyText}>No categories yet. Tap below to add one!</Text>
          )}
        </View>

        {/* CTA */}
        <Pressable
          style={[s.dayButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Day', { date: format(new Date(), 'yyyy-MM-dd') })}
        >
          <Text style={s.dayButtonText}>View Today's Progress</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const mkStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  statsCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 20,
    marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  winEmoji: { fontSize: 18, lineHeight: 26 },
  otherStreakRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  otherStreakValue: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  otherWinEmoji: { fontSize: 13, marginLeft: 2 },
  otherStreakLabel: { fontSize: 12, color: colors.textSecondary, marginLeft: 1 },
  statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  calendarCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 10, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  categoryList: {
    backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10,
    elevation: 2, marginBottom: 24,
  },
  categoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryInfo: { flexDirection: 'row', alignItems: 'center' },
  folderIcon: { marginRight: 12, opacity: 0.8 },
  categoryTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  emptyText: { textAlign: 'center', padding: 20, color: colors.textSecondary, fontSize: 14 },
  dayButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  dayButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Folder, Settings, ChevronRight, LayoutList } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../lib/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Raw flat list of ALL categories for this participant (all dates)
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  // ── Fetch ALL categories for this participant ───────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. All categories (all dates) for current slot
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, title, date, slot')
        .eq('slot', user.slot);

      if (catError) throw catError;

      const safeData = Array.isArray(catData) ? catData : [];
      setAllCategories(safeData);

      // 2. Item count
      const catIds = safeData.map(c => c.id);
      if (catIds.length > 0) {
        const { count, error: itemError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .in('category_id', catIds);
        if (!itemError) setTotalItems(count || 0);
      } else {
        setTotalItems(0);
      }
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

  // ── CALENDAR DOTS — normalize ALL category dates ───────────────────────────
  // Root fix: build markedDates from ALL allCategories, not just today's.
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    allCategories.forEach(cat => {
      if (!cat?.date) return;
      // Normalize: Supabase returns date as 'YYYY-MM-DD' string (date column).
      // Use the string directly to avoid timezone shifting.
      const normalized = cat.date.slice(0, 10); // safe for both string and Date
      marks[normalized] = {
        marked: true,
        dotColor: '#3B82F6',
      };
    });

    // Highlight today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    marks[todayStr] = {
      ...marks[todayStr],
      selected: true,
      selectedColor: '#EFF6FF',
      selectedTextColor: '#3B82F6',
    };

    return marks;
  }, [allCategories]);

  // ── STREAK — count consecutive days correctly ──────────────────────────────
  const currentStreak = useMemo(() => {
    if (!allCategories.length) return 0;

    // Unique sorted dates descending
    const uniqueDates = Array.from(
      new Set(allCategories.map(c => c.date.slice(0, 10)))
    ).sort((a, b) => b.localeCompare(a)); // descending lexicographic = descending date

    if (!uniqueDates.length) return 0;

    // Check if streak starts from today or yesterday (allow today with no entry yet)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const mostRecent = uniqueDates[0];

    // If most recent date is older than yesterday, streak is broken
    const todayMs = new Date(todayStr).getTime();
    const mostRecentMs = new Date(mostRecent).getTime();
    const dayDiff = (todayMs - mostRecentMs) / (1000 * 60 * 60 * 24);
    if (dayDiff > 1) return 0;

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]).getTime();
      const curr = new Date(uniqueDates[i]).getTime();
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [allCategories]);

  // ── Unique category titles for the list ────────────────────────────────────
  const uniqueCats = useMemo(() => {
    if (!allCategories.length) return [];
    const map = new Map<string, any>();
    allCategories.forEach(c => {
      if (c?.title) map.set(c.title.toLowerCase(), c);
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [allCategories]);

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#999' }}>Please log in</Text>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'User'} 👋</Text>
            <Text style={styles.subtitle}>Track your progress today</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Settings')}>
            <Settings size={24} color="#666" />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Flame size={24} color="#FF9500" />
            </View>
            <View>
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <LayoutList size={24} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.statValue}>{totalItems}</Text>
              <Text style={styles.statLabel}>Total Entries</Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Activity Calendar</Text>
        </View>
        <View style={styles.calendarCard}>
          <Calendar
            markedDates={markedDates}
            onDayPress={(day: any) => navigation.navigate('Day', { date: day.dateString })}
            theme={{
              todayTextColor: '#3B82F6',
              arrowColor: '#3B82F6',
              dotColor: '#3B82F6',
              selectedDotColor: '#3B82F6',
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Categories</Text>
        </View>
        <View style={styles.categoryList}>
          {uniqueCats.map(cat => (
            <Pressable
              key={cat.id}
              style={styles.categoryItem}
              onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.title })}
            >
              <View style={styles.categoryInfo}>
                <Folder size={20} color="#3B82F6" style={styles.folderIcon} />
                <Text style={styles.categoryTitle}>{cat.title}</Text>
              </View>
              <ChevronRight size={20} color="#CCC" />
            </Pressable>
          ))}
          {uniqueCats.length === 0 && (
            <Text style={styles.emptyText}>No categories yet. Tap below to add one!</Text>
          )}
        </View>

        {/* CTA */}
        <Pressable
          style={styles.dayButton}
          onPress={() => navigation.navigate('Day', { date: format(new Date(), 'yyyy-MM-dd') })}
        >
          <Text style={styles.dayButtonText}>View Today's Progress</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#666' },
  statDivider: { width: 1, backgroundColor: '#EEE', marginHorizontal: 15 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  calendarCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  categoryList: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryInfo: { flexDirection: 'row', alignItems: 'center' },
  folderIcon: { marginRight: 12, opacity: 0.7 },
  categoryTitle: { fontSize: 16, color: '#1A1A1A', fontWeight: '500' },
  emptyText: { textAlign: 'center', padding: 20, color: '#999', fontSize: 14 },
  dayButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  dayButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

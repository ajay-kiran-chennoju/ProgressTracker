import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Folder, Settings, ChevronRight, LayoutList } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../lib/types';
import { format, subDays, parseISO, startOfMonth, endOfMonth } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [stats, setStats] = useState({ currentStreak: 0, totalItems: 0 });

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      console.log(`[Home] Fetching data for slot: ${user.slot}`);
      
      // 1. Fetch ALL categories for the current participant (Requirement 2)
      // Use 'slot' as per schema, though user said 'participant_id'
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('slot', user.slot);

      if (catError) throw catError;
      console.log(`[Home] Categories count: ${catData?.length || 0}`);

      // 2. Fetch ALL items to calculate total items correctly
      // We need to join with categories to filter by slot, but since we are doing 
      // direct Supabase, we can fetch all items and filter in JS or use an inner join.
      // Simplest: fetch items for the categories we just got.
      const catIds = catData.map(c => c.id);
      let itemCount = 0;
      if (catIds.length > 0) {
        const { count, error: itemError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .in('category_id', catIds);
        if (!itemError) itemCount = count || 0;
      }
      console.log(`[Home] Total items count: ${itemCount}`);

      // 3. Unique categories for the list (normalized by title)
      const uniqueMap = new Map();
      for (const c of catData) {
        const norm = c.title.trim().toLowerCase();
        if (!uniqueMap.has(norm)) {
          uniqueMap.set(norm, c);
        }
      }
      const uniqueCats = Array.from(uniqueMap.values()).sort((a, b) => a.title.localeCompare(b.title));
      setCategories(uniqueCats);

      // 4. Calculate Streak (Requirement 6)
      const dateSet = new Set(catData.map(c => c.date));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = subDays(today, i);
        const key = format(d, 'yyyy-MM-dd');
        if (dateSet.has(key)) {
          streak += 1;
        } else if (i === 0) {
          // If today has no entry, the streak isn't broken yet
          continue;
        } else {
          break;
        }
      }

      setStats({ currentStreak: streak, totalItems: itemCount });

      // 5. Prepare marked dates for Calendar (Requirement 5)
      const marked: any = {};
      dateSet.forEach(date => {
        marked[date] = { 
          marked: true, 
          dotColor: '#007AFF', 
          activeOpacity: 0 
        };
      });
      // Highlight today
      const todayStr = format(today, 'yyyy-MM-dd');
      marked[todayStr] = {
        ...marked[todayStr],
        selected: true,
        selectedColor: '#E5F1FF',
        selectedTextColor: '#007AFF'
      };
      setMarkedDates(marked);

    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleDayPress = (day: any) => {
    navigation.navigate('Day', { date: day.dateString });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
            <Text style={styles.subtitle}>Track your progress today</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Settings')}>
            <Settings size={24} color="#666" />
          </Pressable>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Flame size={24} color="#FF9500" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: '#E5F1FF' }]}>
              <LayoutList size={24} color="#007AFF" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.totalItems}</Text>
              <Text style={styles.statLabel}>Total Entries</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select a Day</Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            markedDates={markedDates}
            onDayPress={handleDayPress}
            theme={{
              todayTextColor: '#007AFF',
              arrowColor: '#007AFF',
              indicatorColor: '#007AFF',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Categories</Text>
        </View>

        <View style={styles.categoryList}>
          {uniqueCats.map((cat) => (
            <Pressable 
              key={cat.id} 
              style={styles.categoryItem}
              onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.title })}
            >
              <View style={styles.categoryInfo}>
                <Folder size={20} color="#007AFF" style={styles.folderIcon} />
                <Text style={styles.categoryTitle}>{cat.title}</Text>
              </View>
              <ChevronRight size={20} color="#CCC" />
            </Pressable>
          ))}
          {uniqueCats.length === 0 && (
            <Text style={styles.emptyText}>No categories yet. Add one in the Day view!</Text>
          )}
        </View>

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
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
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
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#EEE',
    marginHorizontal: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
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
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderIcon: {
    marginRight: 12,
    opacity: 0.7,
  },
  categoryTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
    fontSize: 14,
  },
  dayButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  dayButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

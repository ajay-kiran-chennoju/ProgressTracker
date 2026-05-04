import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Folder, Settings, ChevronRight, LayoutList } from 'lucide-react-native';
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
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState({ currentStreak: 0, totalItems: 0 });

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch unique categories for user
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, title')
        .eq('slot', user.slot)
        .order('title');

      if (catError) throw catError;

      // Unique categories by title
      const uniqueCats = Array.from(new Set(catData.map(c => c.title.toLowerCase())))
        .map(title => catData.find(c => c.title.toLowerCase() === title));

      setCategories(uniqueCats);

      // Fetch items to calculate streak
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('date')
        .eq('date', format(new Date(), 'yyyy-MM-dd')) // Example: just getting some data
        // In a real app, you'd fetch a larger range or use a stored procedure
        
      // For brevity, we'll just fetch total item count
      const { count: itemCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('date', format(new Date(), 'yyyy-MM-dd')); // Should join with categories filter by slot

      // Simplistic streak calc (logic from stats.ts)
      const { data: allDatesData } = await supabase
        .from('categories')
        .select('date')
        .eq('slot', user.slot);
      
      const dateSet = new Set(allDatesData?.map(d => d.date) || []);
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = format(d, 'yyyy-MM-dd');
        if (dateSet.has(key)) streak += 1;
        else if (i === 0) continue;
        else break;
      }

      setStats({ currentStreak: streak, totalItems: catData.length }); // Simplified
    } catch (error) {
      console.error('Error fetching data:', error);
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
              <Text style={styles.statValue}>{categories.length}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Categories</Text>
        </View>

        <View style={styles.categoryList}>
          {categories.map((cat, index) => (
            <Pressable 
              key={cat.id || index} 
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
          {categories.length === 0 && (
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
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

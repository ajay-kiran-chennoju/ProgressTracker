import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import DayScreen from './src/screens/DayScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AddCategoryScreen from './src/screens/AddCategoryScreen';
import AddEntryScreen from './src/screens/AddEntryScreen';
import AddTaskScreen from './src/screens/AddTaskScreen';
import { RootStackParamList } from './src/lib/types';
import { useCurrentUser } from './src/hooks/useCurrentUser';
import { setupNotifications, scheduleDailyReminder } from './src/lib/notifications';
import { ThemeProvider, useTheme } from './src/lib/theme';
import { carryForwardIncompleteTasks } from './src/lib/taskHelpers';
import { format } from 'date-fns';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user } = useCurrentUser();
  const { colors } = useTheme();

  React.useEffect(() => {
    setupNotifications().then(granted => {
      if (granted) scheduleDailyReminder();
    });
  }, []);

  // ── Carry-forward incomplete tasks on every app launch ─────────────────────
  React.useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    carryForwardIncompleteTasks(today).catch(err =>
      console.warn('[CARRY-FORWARD] error:', err),
    );
  }, []);

  if (!user) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: 'bold', color: colors.text },
          headerTintColor: colors.primary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Progress Tracker' }} />
        <Stack.Screen name="Day" component={DayScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Category"
          component={CategoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />

        {/* Add screens — all have custom headers */}
        <Stack.Screen name="AddCategory" component={AddCategoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddTask" component={AddTaskScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

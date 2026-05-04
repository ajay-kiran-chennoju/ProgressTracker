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
import { RootStackParamList } from './src/lib/types';
import { useCurrentUser } from './src/hooks/useCurrentUser';
import { setupNotifications, scheduleDailyReminder } from './src/lib/notifications';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { user } = useCurrentUser();

  React.useEffect(() => {
    setupNotifications().then(granted => {
      if (granted) {
        scheduleDailyReminder();
      }
    });
  }, []);

  if (!user) {
    return <OnboardingScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Progress Tracker' }} />
          <Stack.Screen name="Day" component={DayScreen} options={({ route }) => ({ title: formatHeaderDate(route.params.date) })} />
          <Stack.Screen name="Category" component={CategoryScreen} options={({ route }) => ({ title: route.params.title })} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

function formatHeaderDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

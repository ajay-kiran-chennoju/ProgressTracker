/**
 * theme.tsx
 *
 * Global theme system with AsyncStorage persistence.
 * Provides a ThemeProvider and useTheme() hook consumed by all screens.
 *
 * Usage:
 *   const { theme, setTheme, colors } = useTheme();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Theme Definitions ────────────────────────────────────────────────────────

export type ThemeId =
  | 'blue'
  | 'purple'
  | 'green'
  | 'orange'
  | 'pink'
  | 'slate'
  | 'teal'
  | 'lavender'
  | 'chocolate';

export interface ThemeColors {
  primary: string;       // main action color
  primaryLight: string;  // light variant (backgrounds, highlights)
  accent: string;        // secondary accent
  background: string;    // screen background
  surface: string;       // card / input surface
  text: string;          // primary text
  textSecondary: string; // muted text
  border: string;        // divider / border color
  taskBg: string;        // pending task card background
  taskBorder: string;    // pending task card border
  danger: string;        // destructive actions
  success: string;       // positive actions
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  emoji: string;
  colors: ThemeColors;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'blue',
    label: 'Ocean Blue',
    emoji: '🌊',
    colors: {
      primary: '#2563EB',
      primaryLight: '#EFF6FF',
      accent: '#3B82F6',
      background: '#F8F9FA',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#F0F7FF',
      taskBorder: '#BFDBFE',
      danger: '#EF4444',
      success: '#10B981',
    },
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    emoji: '💜',
    colors: {
      primary: '#7C3AED',
      primaryLight: '#F5F3FF',
      accent: '#8B5CF6',
      background: '#F9F8FF',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#FAF5FF',
      taskBorder: '#DDD6FE',
      danger: '#EF4444',
      success: '#10B981',
    },
  },
  {
    id: 'green',
    label: 'Forest Green',
    emoji: '🌿',
    colors: {
      primary: '#059669',
      primaryLight: '#ECFDF5',
      accent: '#10B981',
      background: '#F8FAF9',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#F0FDF4',
      taskBorder: '#A7F3D0',
      danger: '#EF4444',
      success: '#059669',
    },
  },
  {
    id: 'orange',
    label: 'Sunset Orange',
    emoji: '🔥',
    colors: {
      primary: '#EA580C',
      primaryLight: '#FFF7ED',
      accent: '#F97316',
      background: '#FAFAF8',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#FFF7ED',
      taskBorder: '#FED7AA',
      danger: '#DC2626',
      success: '#10B981',
    },
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    emoji: '🌸',
    colors: {
      primary: '#DB2777',
      primaryLight: '#FDF2F8',
      accent: '#EC4899',
      background: '#FFF8FB',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#FDF2F8',
      taskBorder: '#FBCFE8',
      danger: '#EF4444',
      success: '#10B981',
    },
  },
  {
    id: 'slate',
    label: 'Dark Slate',
    emoji: '🌑',
    colors: {
      primary: '#334155',
      primaryLight: '#F1F5F9',
      accent: '#475569',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#CBD5E1',
      taskBg: '#F8FAFC',
      taskBorder: '#CBD5E1',
      danger: '#EF4444',
      success: '#10B981',
    },
  },
  {
    id: 'teal',
    label: 'Teal Wave',
    emoji: '🩵',
    colors: {
      primary: '#0D9488',
      primaryLight: '#F0FDFA',
      accent: '#14B8A6',
      background: '#F8FFFE',
      surface: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      taskBg: '#F0FDFA',
      taskBorder: '#99F6E4',
      danger: '#EF4444',
      success: '#0D9488',
    },
  },
  {
    id: 'lavender',
    label: 'Lavender Dream',
    emoji: '🪻',
    colors: {
      primary: '#7B5EA7',
      primaryLight: '#F3EEFF',
      accent: '#9D77CC',
      background: '#FAF8FF',
      surface: '#FFFFFF',
      text: '#2D1B4E',
      textSecondary: '#7E6A9A',
      border: '#E4D9F5',
      taskBg: '#F3EEFF',
      taskBorder: '#C9B5E8',
      danger: '#EF4444',
      success: '#10B981',
    },
  },
  {
    id: 'chocolate',
    label: 'Dark Chocolate',
    emoji: '🍫',
    colors: {
      primary: '#6B3A2A',
      primaryLight: '#FDF0EB',
      accent: '#9C5A3C',
      background: '#FBF7F5',
      surface: '#FFFFFF',
      text: '#2C1A12',
      textSecondary: '#8D6655',
      border: '#EDD9CF',
      taskBg: '#FDF0EB',
      taskBorder: '#D4A898',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
];

const DEFAULT_THEME_ID: ThemeId = 'blue';
const STORAGE_KEY = 'app_theme';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  themeId: ThemeId;
  colors: ThemeColors;
  themes: ThemeDefinition[];
  setThemeId: (id: ThemeId) => Promise<void>;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  colors: THEMES[0].colors,
  themes: THEMES,
  setThemeId: async () => {},
  isLoaded: false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [isLoaded, setIsLoaded] = useState(false);

  // Restore persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && THEMES.find((t) => t.id === stored)) {
          setThemeIdState(stored as ThemeId);
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const setThemeId = useCallback(async (id: ThemeId) => {
    setThemeIdState(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const colors = THEMES.find((t) => t.id === themeId)?.colors ?? THEMES[0].colors;

  return (
    <ThemeContext.Provider value={{ themeId, colors, themes: THEMES, setThemeId, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext);
}

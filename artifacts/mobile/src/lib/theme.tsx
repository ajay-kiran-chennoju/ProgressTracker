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
      primary: '#1D4ED8',
      primaryLight: '#DBEAFE',
      accent: '#2563EB',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#475569',
      border: '#CBD5E1',
      taskBg: '#EFF6FF',
      taskBorder: '#93C5FD',
      danger: '#DC2626',
      success: '#059669',
    },
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    emoji: '💜',
    colors: {
      primary: '#6D28D9',
      primaryLight: '#EDE9FE',
      accent: '#7C3AED',
      background: '#F8F7FF',
      surface: '#FFFFFF',
      text: '#1E1B4B',
      textSecondary: '#6366F1',
      border: '#DDD6FE',
      taskBg: '#F5F3FF',
      taskBorder: '#C4B5FD',
      danger: '#E11D48',
      success: '#10B981',
    },
  },
  {
    id: 'green',
    label: 'Forest Green',
    emoji: '🌿',
    colors: {
      primary: '#047857',
      primaryLight: '#D1FAE5',
      accent: '#059669',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      text: '#064E3B',
      textSecondary: '#10B981',
      border: '#A7F3D0',
      taskBg: '#ECFDF5',
      taskBorder: '#6EE7B7',
      danger: '#DC2626',
      success: '#059669',
    },
  },
  {
    id: 'orange',
    label: 'Sunset Orange',
    emoji: '🔥',
    colors: {
      primary: '#C2410C',
      primaryLight: '#FFEDD5',
      accent: '#EA580C',
      background: '#FFF7ED',
      surface: '#FFFFFF',
      text: '#431407',
      textSecondary: '#F97316',
      border: '#FED7AA',
      taskBg: '#FFF7ED',
      taskBorder: '#FDBA74',
      danger: '#B91C1C',
      success: '#10B981',
    },
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    emoji: '🌸',
    colors: {
      primary: '#BE185D',
      primaryLight: '#FCE7F3',
      accent: '#DB2777',
      background: '#FFF1F2',
      surface: '#FFFFFF',
      text: '#500724',
      textSecondary: '#EC4899',
      border: '#FBCFE8',
      taskBg: '#FDF2F8',
      taskBorder: '#F9A8D4',
      danger: '#E11D48',
      success: '#10B981',
    },
  },
  {
    id: 'slate',
    label: 'Dark Slate',
    emoji: '🌑',
    colors: {
      primary: '#1E293B',
      primaryLight: '#E2E8F0',
      accent: '#334155',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#020617',
      textSecondary: '#64748B',
      border: '#94A3B8',
      taskBg: '#F8FAFC',
      taskBorder: '#CBD5E1',
      danger: '#E11D48',
      success: '#10B981',
    },
  },
  {
    id: 'teal',
    label: 'Teal Wave',
    emoji: '🩵',
    colors: {
      primary: '#0F766E',
      primaryLight: '#CCFBF1',
      accent: '#0D9488',
      background: '#F0FDFA',
      surface: '#FFFFFF',
      text: '#042F2E',
      textSecondary: '#14B8A6',
      border: '#99F6E4',
      taskBg: '#F0FDFA',
      taskBorder: '#5EEAD4',
      danger: '#E11D48',
      success: '#0D9488',
    },
  },
  {
    id: 'lavender',
    label: 'Lavender Dream',
    emoji: '🪻',
    colors: {
      primary: '#5B21B6',
      primaryLight: '#EDE9FE',
      accent: '#7C3AED',
      background: '#F5F3FF',
      surface: '#FFFFFF',
      text: '#2E1065',
      textSecondary: '#8B5CF6',
      border: '#C4B5FD',
      taskBg: '#F5F3FF',
      taskBorder: '#A78BFA',
      danger: '#E11D48',
      success: '#10B981',
    },
  },
  {
    id: 'chocolate',
    label: 'Dark Chocolate',
    emoji: '🍫',
    colors: {
      primary: '#451A03',
      primaryLight: '#FFEDD5',
      accent: '#92400E',
      background: '#FFF7ED',
      surface: '#FFFFFF',
      text: '#271710',
      textSecondary: '#92400E',
      border: '#D6D3D1',
      taskBg: '#FDF0EB',
      taskBorder: '#A8A29E',
      danger: '#991B1B',
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

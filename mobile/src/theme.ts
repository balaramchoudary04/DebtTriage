import { useColorScheme } from 'react-native';

// ──────────────────────────────────────
// Color Palettes
// ──────────────────────────────────────

export const LightColors = {
  primary: '#01696F',
  primaryLight: '#E6F4F5',
  background: '#F7F6F2',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#7A7974',
  destructive: '#C9302C',
  success: '#437A22',
  warning: '#D19900',
  border: '#E5E5E0',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E5E0',
  inputBackground: '#F7F6F2',
  overlay: 'rgba(0,0,0,0.5)',
};

export const DarkColors = {
  primary: '#4F98A3',
  primaryLight: '#1A2E30',
  background: '#141414',
  card: '#1C1C1C',
  text: '#E5E5E3',
  textMuted: '#8A8A88',
  destructive: '#E05250',
  success: '#5FA832',
  warning: '#E8AD00',
  border: '#2A2A2A',
  tabBar: '#1C1C1C',
  tabBarBorder: '#2A2A2A',
  inputBackground: '#242424',
  overlay: 'rgba(0,0,0,0.7)',
};

export type Colors = typeof LightColors;

// ──────────────────────────────────────
// Typography
// ──────────────────────────────────────

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ──────────────────────────────────────
// Spacing
// ──────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ──────────────────────────────────────
// Border Radius
// ──────────────────────────────────────

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

// ──────────────────────────────────────
// Shadows (iOS)
// ──────────────────────────────────────

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
};

// ──────────────────────────────────────
// Theme Hook
// ──────────────────────────────────────

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors: Colors = isDark ? DarkColors : LightColors;
  return { colors, isDark };
}

// ──────────────────────────────────────
// Debt Type Labels & Colors
// ──────────────────────────────────────

export const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: 'Credit Card',
  personal_loan: 'Personal Loan',
  auto_loan: 'Auto Loan',
  student_loan: 'Student Loan',
  medical: 'Medical',
  other: 'Other',
};

export const DEBT_TYPE_OPTIONS = [
  { label: 'Credit Card', value: 'credit_card' },
  { label: 'Personal Loan', value: 'personal_loan' },
  { label: 'Auto Loan', value: 'auto_loan' },
  { label: 'Student Loan', value: 'student_loan' },
  { label: 'Medical', value: 'medical' },
  { label: 'Other', value: 'other' },
];

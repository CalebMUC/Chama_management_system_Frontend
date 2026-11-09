import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
/** Compact suits officials at a desk; comfortable loosens rows and panels. Drives CSS variables in globals.css. */
export type Density = 'compact' | 'comfortable';

interface PreferencesState {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
  /** Sidebar groups the user folded, by group label. */
  collapsedGroups: string[];
  /** Mask balances and account numbers on member (My banking) screens. */
  hideBalances: boolean;
  /** The licence-expiry banner was dismissed for this licence key until this day ("YYYY-MM-DD"). */
  licenceBannerDismissed: { key: string; until: string } | null;
  set<K extends keyof Omit<PreferencesState, 'set'>>(key: K, value: PreferencesState[K]): void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      density: 'compact',
      sidebarCollapsed: false,
      collapsedGroups: [],
      hideBalances: false,
      licenceBannerDismissed: null,
      set: (key, value) => set({ [key]: value } as Partial<PreferencesState>),
    }),
    { name: 'chama.preferences', storage: createJSONStorage(() => localStorage) },
  ),
);

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
}

export function applyDensity(density: Density) {
  document.documentElement.dataset.density = density;
}

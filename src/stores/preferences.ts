import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface PreferencesState {
  theme: Theme;
  sidebarCollapsed: boolean;
  /** The licence-expiry banner was dismissed for this licence key until this day ("YYYY-MM-DD"). */
  licenceBannerDismissed: { key: string; until: string } | null;
  set<K extends keyof Omit<PreferencesState, 'set'>>(key: K, value: PreferencesState[K]): void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
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

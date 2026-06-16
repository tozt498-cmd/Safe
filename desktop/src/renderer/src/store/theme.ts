import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
  init: () => void;
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}

export const useTheme = create<ThemeState>((set, getState) => ({
  theme: (localStorage.getItem('sm.theme') as Theme) || 'dark',
  toggle: () => getState().set(getState().theme === 'dark' ? 'light' : 'dark'),
  set: (theme) => {
    localStorage.setItem('sm.theme', theme);
    apply(theme);
    window.api.app.setSettings({ theme }).catch(() => {});
    set({ theme });
  },
  init: () => apply(getState().theme),
}));

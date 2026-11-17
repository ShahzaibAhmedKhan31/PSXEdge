import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, readRaw, writeRaw } from '../lib/storage';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveInitialTheme(): Theme {
  // The inline script in index.html already applied the correct class.
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  const stored = readRaw(STORAGE_KEYS.theme);
  if (stored === 'light' || stored === 'dark') return stored;
  return systemTheme();
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    writeRaw(STORAGE_KEYS.theme, theme);
  }, [theme]);

  // Follow the OS theme only while the user has not chosen one explicitly.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const stored = readRaw(STORAGE_KEYS.theme);
    if (stored === 'light' || stored === 'dark') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setThemeState(event.matches ? 'dark' : 'light');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return { theme, toggleTheme, setTheme };
}

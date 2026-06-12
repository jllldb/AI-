import React, { createContext, useContext, type ReactNode } from 'react';
import { usePreferences } from '../hooks/usePreferences';

type PreferencesCtx = ReturnType<typeof usePreferences>;

const Context = createContext<PreferencesCtx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePreferences();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePreferencesContext(): PreferencesCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('usePreferencesContext must be used inside PreferencesProvider');
  return ctx;
}

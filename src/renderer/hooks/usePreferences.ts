import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../lib/electron-api';

export function usePreferences() {
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApi().getPreferences().then(p => {
      setPreferences(p || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updatePreference = useCallback((key: string, value: string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const savePreferences = useCallback(async (newPrefs: Record<string, string>) => {
    await getApi().setPreferences(newPrefs);
    setPreferences(newPrefs);
  }, []);

  return { preferences, loading, updatePreference, savePreferences };
}

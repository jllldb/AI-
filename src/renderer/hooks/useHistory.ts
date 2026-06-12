import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../lib/electron-api';
import type { ConversationTurn } from '../../shared/types';

export function useHistory() {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const result = await getApi().getHistory(query || undefined);
      setTurns(result);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

  return { turns, loading, search, setSearch, refresh: () => load(search) };
}

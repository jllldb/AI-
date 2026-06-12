import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConversationState, AIResponse, ConversationTurn, CostSummary } from '../../shared/types';
import { getApi } from '../lib/electron-api';

export function useConversation() {
  const [state, setState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [costSummary, setCostSummary] = useState<CostSummary>({
    todayTokens: 0, todayCost: 0, dailyBudget: 5,
    callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0,
  });
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    const api = getApi();

    const c1 = api.onStateChange((s) => {
      setState(s);
      if (s === 'processing' && lastTranscriptRef.current && lastTranscriptRef.current !== '🎤 正在听...') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'user' && last.timestamp > Date.now() - 5000) return prev;
          return [...prev, {
            id: '', timestamp: Date.now(), role: 'user',
            content: lastTranscriptRef.current, modelUsed: 'deepseek', tokensUsed: 0,
          }];
        });
      }
    });

    const c2 = api.onTranscript((t) => {
      setTranscript(t);
      lastTranscriptRef.current = t;
    });

    const c3 = api.onResponse((r) => {
      setMessages(prev => [...prev, {
        id: '', timestamp: Date.now(), role: 'assistant',
        content: r.text, visualDescription: r.visualDescription,
        modelUsed: r.modelUsed, tokensUsed: r.tokensUsed,
      }]);
    });

    const c4 = api.onCostUpdate((c) => setCostSummary(c));
    const c5 = api.onAudioLevel((l) => setAudioLevel(l));

    // Cleanup all listeners on unmount
    return () => { c1(); c2(); c3(); c4(); c5(); };
  }, []);

  const sendTextMessage = useCallback(async (text: string, includeFrame: boolean) => {
    setMessages(prev => [...prev, {
      id: '', timestamp: Date.now(), role: 'user',
      content: text, modelUsed: 'deepseek', tokensUsed: 0,
    }]);
    setState('processing');
    const resp = await getApi().sendMessage(text, includeFrame);
    if (resp) {
      setMessages(prev => [...prev, {
        id: '', timestamp: Date.now(), role: 'assistant',
        content: resp.text, visualDescription: resp.visualDescription,
        modelUsed: resp.modelUsed, tokensUsed: resp.tokensUsed,
      }]);
    }
    setState('idle');
  }, []);

  return { state, messages, transcript, audioLevel, costSummary, sendTextMessage };
}

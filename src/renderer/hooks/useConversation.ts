import { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationState, AIResponse, ConversationTurn, CostSummary } from '../../shared/types';

export function useConversation() {
  const [state, setState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [transcript, setTranscript] = useState('');
  const [costSummary, setCostSummary] = useState<CostSummary>({
    todayTokens: 0, todayCost: 0, dailyBudget: 5,
    callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;
    api.onStateChange((s: ConversationState) => setState(s));
    api.onTranscript((t: string) => setTranscript(t));
    api.onResponse((r: AIResponse) => {
      setMessages(prev => [...prev, {
        id: '', timestamp: Date.now(), role: 'assistant',
        content: r.text, visualDescription: r.visualDescription,
        modelUsed: r.modelUsed, tokensUsed: r.tokensUsed,
      }]);
    });
    api.onCostUpdate((c: CostSummary) => setCostSummary(c));
  }, []);

  const sendTextMessage = useCallback(async (text: string, includeFrame: boolean) => {
    setMessages(prev => [...prev, {
      id: '', timestamp: Date.now(), role: 'user',
      content: text, modelUsed: 'deepseek', tokensUsed: 0,
    }]);
    setState('processing');
    const resp = await (window as any).electronAPI?.sendMessage(text, includeFrame);
    if (resp) {
      setMessages(prev => [...prev, {
        id: '', timestamp: Date.now(), role: 'assistant',
        content: resp.text, visualDescription: resp.visualDescription,
        modelUsed: resp.modelUsed, tokensUsed: resp.tokensUsed,
      }]);
    }
    setState('idle');
  }, []);

  return { state, messages, transcript, costSummary, sendTextMessage, audioRef };
}

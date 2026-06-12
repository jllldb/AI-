import React, { createContext, useContext, type ReactNode } from 'react';
import { useConversation } from '../hooks/useConversation';

type ConversationCtx = ReturnType<typeof useConversation>;

const Context = createContext<ConversationCtx | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const value = useConversation();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConversationContext(): ConversationCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useConversationContext must be used inside ConversationProvider');
  return ctx;
}

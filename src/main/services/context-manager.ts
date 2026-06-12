import { ConversationTurn, ContextWindow } from '../../shared/types';
import { conversationStore } from '../store/conversation-store';

export class ContextManager {
  getContext(): ContextWindow {
    const allTurns = conversationStore.getRecentTurns(30);
    if (allTurns.length <= 10) {
      return { recentTurns: allTurns.reverse() };
    }
    const recent = allTurns.slice(0, 10).reverse();
    const old = allTurns.slice(10);
    const summary = this.summarize(old);
    return { recentTurns: recent, summary };
  }

  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    return conversationStore.addTurn(turn);
  }

  buildMessages(context: ContextWindow, currentUserMessage: string): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];
    let sysPrompt = '你是一个 AI 视觉对话助手，能够看到摄像头画面并听到用户说话。请用中文简洁自然地回答。';
    if (context.summary) sysPrompt += '\n\n[之前对话摘要] ' + context.summary;
    messages.push({ role: 'system', content: sysPrompt });
    for (const turn of context.recentTurns) {
      if (turn.role === 'user' || turn.role === 'assistant') {
        let content = turn.content;
        if (turn.visualDescription) content = '[画面: ' + turn.visualDescription + ']\n' + content;
        messages.push({ role: turn.role, content });
      }
    }
    messages.push({ role: 'user', content: currentUserMessage });
    return messages;
  }

  private summarize(turns: ConversationTurn[]): string {
    const text = turns.filter(t => t.role !== 'system').map(t => t.content).join(' ');
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  }
}

export const contextManager = new ContextManager();

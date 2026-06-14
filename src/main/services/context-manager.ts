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
    // Prompt: be a conversational partner, NOT a scene describer
    let sysPrompt = '你是用户的AI聊天伙伴。重要规则：1) 正常对话时只回应用户说的话，不要描述画面；2) 只有用户明确说"看看""描述一下""我面前有什么"时才看图回答；3) 回答尽量简短，像微信聊天一样。';
    if (context.summary) sysPrompt += '\n[之前摘要] ' + context.summary;
    messages.push({ role: 'system', content: sysPrompt });
    for (const turn of context.recentTurns) {
      if (turn.role === 'user' || turn.role === 'assistant') {
        messages.push({ role: turn.role, content: turn.content });
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

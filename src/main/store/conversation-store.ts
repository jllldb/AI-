import { getDatabase } from './database';
import { ConversationTurn } from '../../shared/types';
import type { IConversationStore } from '../core/interfaces';
import { randomUUID } from 'crypto';

export class ConversationStore implements IConversationStore {
  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    const db = getDatabase();
    const id = randomUUID();
    const timestamp = Date.now();
    db.prepare('INSERT INTO conversations (id,timestamp,role,content,image_base64,visual_description,model_used,tokens_used) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, timestamp, turn.role, turn.content, turn.imageBase64 ?? null, turn.visualDescription ?? null, turn.modelUsed, turn.tokensUsed);
    if (turn.role !== 'system') {
      const row = db.prepare('SELECT rowid FROM conversations WHERE id=?').get(id) as any;
      if (row) db.prepare('INSERT INTO conversations_fts(rowid,content) VALUES (?,?)').run(row.rowid, turn.content);
    }
    return { ...turn, id, timestamp };
  }

  getRecentTurns(limit = 10): ConversationTurn[] {
    return getDatabase().prepare('SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?').all(limit) as ConversationTurn[];
  }

  searchHistory(query: string, limit = 50): ConversationTurn[] {
    return getDatabase().prepare(
      'SELECT c.* FROM conversations c INNER JOIN conversations_fts fts ON c.rowid=fts.rowid WHERE conversations_fts MATCH ? ORDER BY c.timestamp DESC LIMIT ?'
    ).all(query, limit) as ConversationTurn[];
  }
}

export const conversationStore = new ConversationStore();

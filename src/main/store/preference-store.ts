import { getDatabase } from './database';
import type { IPreferenceStore } from '../core/interfaces';

// All API keys are empty by default — each user must configure their own
const DEFAULTS: Record<string, string> = {
  // API Keys — 五大供应商
  qwenApiKey: '',          // 阿里云千问 (DashScope)
  deepseekApiKey: '',      // DeepSeek
  openaiApiKey: '',        // OpenAI (GPT-4o/GPT-4o-mini)
  geminiApiKey: '',        // Google Gemini
  claudeApiKey: '',        // Anthropic Claude

  // Provider & Model selection
  modelProvider: 'qwen',        // 'qwen' | 'deepseek' | 'openai' | 'gemini' | 'claude' | 'auto'
  qwenModel: 'qwen-vl-plus',
  deepseekModel: 'deepseek-chat',
  openaiModel: 'gpt-4o',
  geminiModel: 'gemini-2.5-flash',
  claudeModel: 'claude-sonnet-4-6',

  // TTS
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: '1.0',

  // Budget
  dailyBudget: '5',
  accessibilityInterval: '5',
};

export class PreferenceStore implements IPreferenceStore {
  init() {
    const db = getDatabase();
    db.exec('CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const insert = db.prepare('INSERT OR IGNORE INTO preferences (key,value) VALUES (?,?)');
    for (const [k, v] of Object.entries(DEFAULTS)) insert.run(k, v);
  }

  get(key: string): string {
    const row = getDatabase().prepare('SELECT value FROM preferences WHERE key=?').get(key) as any;
    return row?.value ?? DEFAULTS[key] ?? '';
  }

  getAll(): Record<string, string> {
    const rows = getDatabase().prepare('SELECT key,value FROM preferences').all() as any[];
    const result: Record<string, string> = {};
    for (const r of rows) result[r.key] = r.value;
    return result;
  }

  set(key: string, value: string) {
    getDatabase().prepare('INSERT OR REPLACE INTO preferences (key,value) VALUES (?,?)').run(key, value);
  }
}

export const preferenceStore = new PreferenceStore();

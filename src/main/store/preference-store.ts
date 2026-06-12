import { getDatabase } from './database';

const DEFAULTS: Record<string, string> = {
  qwenApiKey: 'sk-f3e3201bcbc84bdb8195599ff69b44bf',
  deepseekApiKey: '',
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: '1.0',
  dailyBudget: '5',
  accessibilityInterval: '5',
};

export class PreferenceStore {
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

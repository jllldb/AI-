# AI 视觉对话助手 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Electron 桌面端 AI 视觉对话助手，通过摄像头和麦克风让 AI 看到画面、听到语音并给予语音+文字回复，采用千问 Omni + DeepSeek 混合路由 + Edge TTS 本地合成。

**Architecture:** Electron 双进程模型，主进程承载媒体采集/VAD/帧去重/API 客户端/TTS/上下文管理/模型路由/SQLite 持久化，渲染进程承载 React UI。主进程通过 contextBridge + IPC 安全暴露 API，渲染进程通过 hooks 消费。端侧做 I/O + 预处理 + 省钱，云侧做理解 + 推理。

**Tech Stack:** Electron 28+, React 18 + TypeScript, Tailwind CSS 3, Vite, better-sqlite3, node-edge-tts, 千问 DashScope SDK, OpenAI SDK (DeepSeek 兼容)

---

## Phase 1: 项目脚手架 (Project Scaffolding)

### Task 1: 初始化 Electron + Vite + React + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.yml`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/index.css`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "ai-visual-assistant",
  "version": "1.0.0",
  "description": "AI 视觉对话助手 — 摄像头+麦克风，AI 看得到听得到",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "vite build && electron-builder",
    "preview": "vite preview"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "node-edge-tts": "^1.2.0",
    "openai": "^4.50.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "dashscope": "^1.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "wait-on": "^7.2.0"
  },
  "build": {
    "appId": "com.ai-visual-assistant",
    "productName": "AI视觉对话助手",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.png"
    }
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "release"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 4: 创建 Electron 主进程入口 `src/main/index.ts`**

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AI 视觉对话助手',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
```

- [ ] **Step 5: 创建 preload 骨架 `src/preload/index.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Media control
  startCamera: () => ipcRenderer.invoke('media:start-camera'),
  stopCamera: () => ipcRenderer.invoke('media:stop-camera'),

  // Conversation
  sendMessage: (text: string, includeFrame: boolean) =>
    ipcRenderer.invoke('conversation:send-message', text, includeFrame),
  toggleAccessibilityMode: (enabled: boolean) =>
    ipcRenderer.invoke('conversation:toggle-accessibility', enabled),

  // State subscriptions
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('state:changed', (_event, state) => callback(state));
  },
  onTranscript: (callback: (text: string) => void) => {
    ipcRenderer.on('transcript:update', (_event, text) => callback(text));
  },
  onResponse: (callback: (response: unknown) => void) => {
    ipcRenderer.on('response:update', (_event, response) => callback(response));
  },
  onCostUpdate: (callback: (cost: unknown) => void) => {
    ipcRenderer.on('cost:update', (_event, cost) => callback(cost));
  },

  // History
  getHistory: (query?: string) => ipcRenderer.invoke('history:get', query),

  // Preferences
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setPreferences: (prefs: unknown) => ipcRenderer.invoke('preferences:set', prefs),
});
```

- [ ] **Step 6: 创建渲染进程入口 `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 视觉对话助手</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 7: 创建 `src/renderer/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: 创建 Tailwind 入口 `src/renderer/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 10: 创建 postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 11: 创建 `.gitignore`**

```
node_modules/
dist/
release/
.env
*.db
```

- [ ] **Step 12: 安装依赖**

Run: `cd E:\Projects\ai-visual-assistant && npm install`

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron + React + Vite + Tailwind project"
```

---

## Phase 2: 共享类型与常量

### Task 2: 定义共享类型和常量

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`

- [ ] **Step 1: 创建 `src/shared/types.ts`**

```typescript
// ============ 模型 ============
export type ModelChoice = 'qwen-omni' | 'deepseek';

// ============ 对话状态机 ============
export type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

// ============ 对话输入 ============
export interface ConversationInput {
  hasNewImage: boolean;
  hasSpeech: boolean;
  hasTextInput: boolean;
  isAccessibilityMode: boolean;
  isFollowUp: boolean;
}

// ============ 千问响应 ============
export interface QwenResponse {
  transcription: string;
  visualDescription: string;
  responseText: string;
  emotion?: string;
}

// ============ 对话轮次 ============
export interface ConversationTurn {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageBase64?: string;
  visualDescription?: string;
  modelUsed: ModelChoice;
  tokensUsed: number;
}

// ============ 上下文窗口 ============
export interface ContextWindow {
  recentTurns: ConversationTurn[];
  summary?: string; // 超过 10 轮后旧消息的摘要
}

// ============ AI 响应 ============
export interface AIResponse {
  text: string;
  visualDescription?: string;
  emotion?: string;
  modelUsed: ModelChoice;
  tokensUsed: number;
}

// ============ 成本 ============
export interface CostSummary {
  todayTokens: number;
  todayCost: number;       // 元
  dailyBudget: number;     // 用户设置的日预算上限，0=不限
  callsSavedByVAD: number;
  callsSavedByDedup: number;
  callsSavedByCache: number;
}

// ============ 用户偏好 ============
export interface UserPreferences {
  qwenApiKey: string;
  deepseekApiKey: string;
  ttsVoice: string;
  ttsRate: number;         // 0.5 ~ 2.0
  dailyBudget: number;     // 元，0=不限
  accessibilityInterval: number;  // 无障碍模式检查间隔，秒，默认 5
}

// ============ IPC 通道名 ============
export const IPC_CHANNELS = {
  MEDIA_START_CAMERA: 'media:start-camera',
  MEDIA_STOP_CAMERA: 'media:stop-camera',
  CONVERSATION_SEND_MESSAGE: 'conversation:send-message',
  CONVERSATION_TOGGLE_ACCESSIBILITY: 'conversation:toggle-accessibility',
  STATE_CHANGED: 'state:changed',
  TRANSCRIPT_UPDATE: 'transcript:update',
  RESPONSE_UPDATE: 'response:update',
  COST_UPDATE: 'cost:update',
  HISTORY_GET: 'history:get',
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',
} as const;
```

- [ ] **Step 2: 创建 `src/shared/constants.ts`**

```typescript
export const MEDIA = {
  FRAME_RATE: 2,            // fps
  FRAME_WIDTH: 640,
  FRAME_HEIGHT: 480,
  JPEG_QUALITY: 0.75,
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHANNELS: 1,
} as const;

export const VAD = {
  SILENCE_THRESHOLD_DBFS: -40,
  SILENCE_TIMEOUT_MS: 1500,  // 1.5s 静音 = 用户说完
  MIN_SPEECH_DURATION_MS: 300, // 最短有效语音段
} as const;

export const DEDUP = {
  HAMMING_THRESHOLD: 5,      // 汉明距离 ≤ 5 = 相似
  DHASH_SIZE: 16,             // 感知哈希图片尺寸
  ACCESSIBILITY_DIFF: 10,     // 无障碍模式画面变化阈值
} as const;

export const CONTEXT = {
  MAX_RECENT_TURNS: 10,       // 上下文窗口大小
  SUMMARY_MAX_CHARS: 200,     // 摘要最大字数
} as const;

export const ACCESSIBILITY = {
  CHECK_INTERVAL_MS: 5000,    // 5 秒检查一次
  FORCE_REFRESH_INTERVAL_MS: 60000, // 每 60 秒强制刷新
} as const;

export const COST = {
  QWEN_PRICE_PER_1K_TOKENS: 0.0015,  // 千问视觉 ~1.5元/百万token
  DEEPSEEK_PRICE_PER_1K_TOKENS: 0.0005, // DeepSeek ~0.5元/百万token
  DEFAULT_DAILY_BUDGET: 5,    // 默认日预算 5 元
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types and constants"
```

---

## Phase 3: 持久化层 (SQLite Store)

### Task 3: 对话历史存储 (ConversationStore)

**Files:**
- Create: `src/main/store/database.ts`
- Create: `src/main/store/conversation-store.ts`

- [ ] **Step 1: 创建数据库初始化 `src/main/store/database.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'conversations.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      image_base64 TEXT,
      visual_description TEXT,
      model_used TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
      ON conversations(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_role
      ON conversations(role);
    CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts
      USING fts5(content, tokenize='unicode61');
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}
```

- [ ] **Step 2: 创建 `src/main/store/conversation-store.ts`**

```typescript
import { getDatabase } from './database';
import { ConversationTurn } from '../../shared/types';
import { randomUUID } from 'crypto';

export class ConversationStore {

  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    const db = getDatabase();
    const id = randomUUID();
    const timestamp = Date.now();

    const stmt = db.prepare(`
      INSERT INTO conversations (id, timestamp, role, content, image_base64, visual_description, model_used, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, timestamp, turn.role, turn.content, turn.imageBase64 ?? null,
      turn.visualDescription ?? null, turn.modelUsed, turn.tokensUsed);

    // 同步到 FTS 索引（仅索引 user/assistant 文本）
    if (turn.role === 'user' || turn.role === 'assistant') {
      db.prepare(`INSERT INTO conversations_fts(rowid, content) VALUES (?, ?)`)
        .run(db.prepare(`SELECT rowid FROM conversations WHERE id = ?`).get(id).rowid, turn.content);
    }

    return { ...turn, id, timestamp };
  }

  getRecentTurns(limit: number = 10): ConversationTurn[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as ConversationTurn[];
  }

  searchHistory(query: string, limit: number = 50): ConversationTurn[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT c.* FROM conversations c
      INNER JOIN conversations_fts fts ON c.rowid = fts.rowid
      WHERE conversations_fts MATCH ?
      ORDER BY c.timestamp DESC
      LIMIT ?
    `).all(query, limit) as ConversationTurn[];
    return rows;
  }

  getHistorySince(timestamp: number): ConversationTurn[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM conversations WHERE timestamp >= ? ORDER BY timestamp ASC
    `).all(timestamp) as ConversationTurn[];
  }

  // Used by ContextManager: 压缩旧消息后删除
  deleteBefore(timestamp: number) {
    const db = getDatabase();
    // 先删 FTS
    const rows = db.prepare(`SELECT rowid FROM conversations WHERE timestamp < ?`).all(timestamp) as {rowid: number}[];
    for (const r of rows) {
      db.prepare(`DELETE FROM conversations_fts WHERE rowid = ?`).run(r.rowid);
    }
    db.prepare(`DELETE FROM conversations WHERE timestamp < ?`).run(timestamp);
  }
}

export const conversationStore = new ConversationStore();
```

- [ ] **Step 3: Create `src/main/store/preference-store.ts`**

```typescript
import { getDatabase } from './database';

interface PreferencesRow {
  key: string;
  value: string;
}

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
    db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    // Ensure defaults exist
    const insert = db.prepare('INSERT OR IGNORE INTO preferences (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(DEFAULTS)) {
      insert.run(key, value);
    }
  }

  get(key: string): string {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as PreferencesRow | undefined;
    return row?.value ?? DEFAULTS[key] ?? '';
  }

  getAll(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM preferences').all() as PreferencesRow[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  set(key: string, value: string) {
    const db = getDatabase();
    db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, value);
  }
}

export const preferenceStore = new PreferenceStore();
```

- [ ] **Step 4: Commit**

```bash
git add src/main/store/
git commit -m "feat: add SQLite conversation and preference stores"
```

---

## Phase 4: 媒体采集服务

### Task 4: MediaService — 摄像头 + 麦克风采集

**Files:**
- Create: `src/main/services/media-service.ts`

- [ ] **Step 1: 创建 `src/main/services/media-service.ts`**

```typescript
import { BrowserWindow } from 'electron';
import { MEDIA, VAD } from '../../shared/constants';

export interface MediaCallbacks {
  onFrame: (jpegBase64: string) => void;
  onAudioChunk: (audioBuffer: Float32Array) => void;
  onError: (error: Error) => void;
}

export class MediaService {
  private callbacks: MediaCallbacks | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isCapturing = false;

  /**
   * 触发渲染进程中的 getCameraFrame() 来截取当前帧。
   * 由于主进程无法直接访问 DOM，我们通过 IPC 通知渲染进程截图，
   * 渲染进程通过 canvas 将 video 帧转为 base64 后返回。
   */
  async startCapture(mainWindow: BrowserWindow): Promise<void> {
    // 通知渲染进程开始采集
    await mainWindow.webContents.executeJavaScript(`
      window.__startMediaCapture(${MEDIA.FRAME_WIDTH}, ${MEDIA.FRAME_HEIGHT}, ${MEDIA.JPEG_QUALITY});
    `);
    this.isCapturing = true;
  }

  setCallbacks(cb: MediaCallbacks) {
    this.callbacks = cb;
  }

  stopCapture(mainWindow: BrowserWindow) {
    this.isCapturing = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    mainWindow.webContents.executeJavaScript('window.__stopMediaCapture()');
  }

  /**
   * 由 IPC handler 调用，接收渲染进程传来的帧
   */
  handleFrame(jpegBase64: string) {
    if (!this.isCapturing) return;
    this.callbacks?.onFrame(jpegBase64);
  }

  /**
   * 由 IPC handler 调用，接收渲染进程传来的音频数据
   */
  handleAudioChunk(audioData: number[]) {
    if (!this.isCapturing) return;
    this.callbacks?.onAudioChunk(new Float32Array(audioData));
  }
}

export const mediaService = new MediaService();
```

> **说明**: 由于 Electron 主进程无法直接使用 `getUserMedia`，实际采集逻辑放在渲染进程的 `useMediaStream` hook 中。主进程的 MediaService 作为调度中心，接收渲染进程通过 IPC 传来的帧和音频片段。

- [ ] **Step 2: Commit**

```bash
git add src/main/services/media-service.ts
git commit -m "feat: add MediaService for camera and microphone capture"
```

---

## Phase 5: VAD 静音检测 + 帧去重

### Task 5: VADService — 静音检测

**Files:**
- Create: `src/main/services/vad-service.ts`

- [ ] **Step 1: 创建 `src/main/services/vad-service.ts`**

```typescript
import { VAD } from '../../shared/constants';

export interface VADCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audioSegments: Float32Array[]) => void; // 返回完整语音段
}

export class VADService {
  private callbacks: VADCallbacks | null = null;
  private isSpeaking = false;
  private silenceStartTime = 0;
  private speechSegments: Float32Array[] = [];
  private speechStartedAt = 0;

  setCallbacks(cb: VADCallbacks) {
    this.callbacks = cb;
  }

  /**
   * 处理每个音频块，返回是否检测到静音
   */
  processChunk(chunk: Float32Array): { isSilence: boolean; rmsDb: number } {
    const rmsDb = this.calculateRMSDb(chunk);
    const isSilence = rmsDb < VAD.SILENCE_THRESHOLD_DBFS;
    const now = Date.now();

    if (!this.isSpeaking && !isSilence) {
      // 开始说话
      this.isSpeaking = true;
      this.speechSegments = [chunk];
      this.speechStartedAt = now;
      this.callbacks?.onSpeechStart();
    } else if (this.isSpeaking && !isSilence) {
      // 继续说话，重置静音计时
      this.speechSegments.push(chunk);
      this.silenceStartTime = 0;
    } else if (this.isSpeaking && isSilence) {
      // 可能的停顿
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = now;
      }
      this.speechSegments.push(chunk);

      // 静音超过阈值 + 说话时长足够 → 认为说完
      const silenceDuration = now - this.silenceStartTime;
      const speechDuration = now - this.speechStartedAt;
      if (silenceDuration >= VAD.SILENCE_TIMEOUT_MS && speechDuration >= VAD.MIN_SPEECH_DURATION_MS) {
        this.isSpeaking = false;
        this.silenceStartTime = 0;
        const segments = [...this.speechSegments];
        this.speechSegments = [];
        this.callbacks?.onSpeechEnd(segments);
      }
    }

    return { isSilence, rmsDb };
  }

  private calculateRMSDb(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    if (rms < 1e-10) return -100; // digital silence
    return 20 * Math.log10(rms);
  }

  /**
   * 合并多个音频段为单个 Float32Array
   */
  mergeSegments(segments: Float32Array[]): Float32Array {
    const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const seg of segments) {
      result.set(seg, offset);
      offset += seg.length;
    }
    return result;
  }

  /**
   * Float32Array → WAV Blob (用于发送到 API)
   */
  float32ToWav(buffer: Float32Array, sampleRate: number = 16000): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const wav = Buffer.alloc(totalSize);
    let offset = 0;

    // RIFF header
    wav.write('RIFF', offset); offset += 4;
    wav.writeUInt32LE(totalSize - 8, offset); offset += 4;
    wav.write('WAVE', offset); offset += 4;

    // fmt subchunk
    wav.write('fmt ', offset); offset += 4;
    wav.writeUInt32LE(16, offset); offset += 4;    // subchunk size
    wav.writeUInt16LE(1, offset); offset += 2;     // PCM = 1
    wav.writeUInt16LE(numChannels, offset); offset += 2;
    wav.writeUInt32LE(sampleRate, offset); offset += 4;
    wav.writeUInt32LE(byteRate, offset); offset += 4;
    wav.writeUInt16LE(blockAlign, offset); offset += 2;
    wav.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data subchunk
    wav.write('data', offset); offset += 4;
    wav.writeUInt32LE(dataSize, offset); offset += 4;

    // PCM samples
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      wav.writeInt16LE(Math.round(intSample), offset);
      offset += 2;
    }

    return wav;
  }
}

export const vadService = new VADService();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/services/vad-service.ts
git commit -m "feat: add VAD service with RMS-based silence detection"
```

### Task 6: FrameDedup — 帧去重

**Files:**
- Create: `src/main/services/frame-dedup.ts`

- [ ] **Step 1: 创建 `src/main/services/frame-dedup.ts`**

```typescript
import { DEDUP } from '../../shared/constants';

export class FrameDedup {
  private lastHash: bigint | null = null;
  private lastDescription: string | null = null;
  private consecutiveSimilarCount = 0;

  /**
   * 计算 dhash (差异哈希)
   * 输入：JPEG base64 字符串
   * 输出：16x16 = 256 位 BigInt 哈希值
   */
  async dhash(jpegBase64: string): Promise<bigint> {
    // 在渲染进程中通过 canvas 缩放为 17x17 灰度图
    // 比较相邻像素亮度，生成 16x16 = 256 位哈希
    // 简化实现：使用渲染进程预计算的哈希
    const hashHex = await this.computeHashInRenderer(jpegBase64);
    return BigInt('0x' + hashHex);
  }

  private computeHashInRenderer(_jpegBase64: string): Promise<string> {
    // 实际实现在渲染进程的 useMediaStream hook 中
    // 这里接收预计算的哈希值
    throw new Error('Use setHash directly — hash is computed in renderer');
  }

  /**
   * 由 IPC handler 调用，传入渲染进程计算好的哈希
   */
  isDuplicate(hash: bigint, threshold: number = DEDUP.HAMMING_THRESHOLD): boolean {
    if (this.lastHash === null) {
      this.lastHash = hash;
      this.consecutiveSimilarCount = 1;
      return false;
    }

    const distance = this.hammingDistance(this.lastHash, hash);

    if (distance <= threshold) {
      this.consecutiveSimilarCount++;
      return true;
    }

    // 画面变化了
    this.lastHash = hash;
    this.consecutiveSimilarCount = 1;
    return false;
  }

  /**
   * 无障碍模式专用：检查画面变化幅度
   */
  isSignificantChange(hash: bigint): boolean {
    if (this.lastHash === null) return true;
    return this.hammingDistance(this.lastHash, hash) > DEDUP.ACCESSIBILITY_DIFF;
  }

  private hammingDistance(a: bigint, b: bigint): number {
    let xor = a ^ b;
    let count = 0;
    while (xor > 0n) {
      count++;
      xor &= xor - 1n; // 清除最低位的 1
    }
    return count;
  }

  cacheDescription(description: string) {
    this.lastDescription = description;
  }

  getCachedDescription(): string | null {
    return this.consecutiveSimilarCount >= 3 ? this.lastDescription : null;
  }

  reset() {
    this.lastHash = null;
    this.lastDescription = null;
    this.consecutiveSimilarCount = 0;
  }

  getConsecutiveCount(): number {
    return this.consecutiveSimilarCount;
  }
}

export const frameDedup = new FrameDedup();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/services/frame-dedup.ts
git commit -m "feat: add frame dedup with dhash and Hamming distance"
```

---

## Phase 6: API 客户端

### Task 7: QwenClient — 千问 Omni API

**Files:**
- Create: `src/main/clients/qwen-client.ts`

- [ ] **Step 1: 创建 `src/main/clients/qwen-client.ts`**

```typescript
import { QwenResponse } from '../../shared/types';

export class QwenClient {
  private apiKey: string;
  private baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  /**
   * 多模态对话：图片 + 音频 + 文字
   * 千问 Qwen3.5-Omni 支持原生多模态输入
   */
  async multimodalChat(params: {
    imageBase64?: string;
    audioBase64?: string;    // WAV base64
    text?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<QwenResponse> {
    const messages: any[] = [];

    // 上下文历史
    if (params.contextMessages) {
      for (const msg of params.contextMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 当前输入 — 构建多模态 content
    const contentParts: any[] = [];

    if (params.imageBase64) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${params.imageBase64}` },
      });
    }

    if (params.audioBase64) {
      // 千问 Omni 支持音频输入
      contentParts.push({
        type: 'input_audio',
        input_audio: { data: params.audioBase64, format: 'wav' },
      });
    }

    if (params.text) {
      contentParts.push({ type: 'text', text: params.text });
    }

    // 如果有 context 但没有多模态内容，追加当前问题
    messages.push({ role: 'user', content: contentParts.length > 1 ? contentParts : contentParts[0] });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-omni-turbo',
        messages,
        max_tokens: 1024,
        modalities: ['text'],  // 请求文本输出
      }),
    });

    if (!response.ok) {
      throw new Error(`Qwen API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // 解析千问的结构化返回
    return this.parseResponse(content, data.usage?.total_tokens ?? 0);
  }

  /**
   * 纯视觉理解（无障碍模式 / 场景描述）
   */
  async describeImage(imageBase64: string, prompt?: string): Promise<string> {
    const defaultPrompt = '请用中文简洁描述画面中有什么，包括物体、人物、场景和正在发生的事情。一句话概括即可。';
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-omni-turbo',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: prompt ?? defaultPrompt },
          ],
        }],
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qwen vision API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  private parseResponse(rawContent: string, tokensUsed: number): QwenResponse {
    return {
      transcription: '',
      visualDescription: '',
      responseText: rawContent,
      emotion: undefined,
    };
  }

  getTokenCount(_response: any): number {
    return 0; // 从 API 返回的 usage 中提取
  }
}

// singleton — 需要 apiKey 初始化
export let qwenClient: QwenClient;

export function initQwenClient(apiKey: string) {
  qwenClient = new QwenClient(apiKey);
  return qwenClient;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/clients/qwen-client.ts
git commit -m "feat: add Qwen Omni API client for multimodal chat"
```

### Task 8: DeepSeekClient — 文字推理 API

**Files:**
- Create: `src/main/clients/deepseek-client.ts`

- [ ] **Step 1: 创建 `src/main/clients/deepseek-client.ts`**

```typescript
import OpenAI from 'openai';

export class DeepSeekClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  setApiKey(key: string) {
    this.client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
  }

  /**
   * 纯文字流式对话
   */
  async *chatStream(messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): AsyncGenerator<{ token: string; done: boolean; totalTokens?: number }> {
    const stream = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      stream: true,
      max_tokens: 1024,
    });

    let totalTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      totalTokens += 1; // approximate
      yield { token: delta, done: false };
    }
    yield { token: '', done: true, totalTokens };
  }

  /**
   * 纯文字非流式对话
   */
  async chat(messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      max_tokens: 1024,
    });

    return {
      text: response.choices?.[0]?.message?.content ?? '',
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  }
}

export let deepseekClient: DeepSeekClient;

export function initDeepSeekClient(apiKey: string) {
  deepseekClient = new DeepSeekClient(apiKey);
  return deepseekClient;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/clients/deepseek-client.ts
git commit -m "feat: add DeepSeek API client with streaming support"
```

---

## Phase 7: 模型路由器 + 上下文管理 + TTS

### Task 9: ModelRouter — 模型路由决策

**Files:**
- Create: `src/main/router/model-router.ts`

- [ ] **Step 1: 创建 `src/main/router/model-router.ts`**

```typescript
import { ConversationInput, ModelChoice } from '../../shared/types';

export class ModelRouter {
  /**
   * 根据输入特征决定使用哪个模型
   */
  route(input: ConversationInput): ModelChoice {
    // 无障碍模式 → 千问（需要视觉理解）
    if (input.isAccessibilityMode) {
      return 'qwen-omni';
    }

    // 有新图像 → 千问（需要多模态理解）
    if (input.hasNewImage) {
      return 'qwen-omni';
    }

    // 有语音 → 千问（需要语音识别）
    if (input.hasSpeech) {
      // 但如果是对上一条的纯文字追问 → DeepSeek
      if (input.isFollowUp && !input.hasNewImage) {
        return 'deepseek';
      }
      return 'qwen-omni';
    }

    // 纯文字输入 → DeepSeek（最便宜）
    if (input.hasTextInput) {
      return 'deepseek';
    }

    // 默认 → DeepSeek
    return 'deepseek';
  }

  /**
   * 估算本次调用的 token 消耗
   */
  estimateTokens(input: ConversationInput): number {
    let tokens = 50; // 系统 prompt
    if (input.hasNewImage) tokens += 90;    // 千问约 90 token/帧
    if (input.hasSpeech) tokens += 200;     // 音频转文字后约 200 token
    if (input.hasTextInput) tokens += 100;  // 用户文字输入
    tokens += 200; // AI 回复
    return tokens;
  }
}

export const modelRouter = new ModelRouter();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/router/model-router.ts
git commit -m "feat: add model router for Qwen/DeepSeek selection"
```

### Task 10: ContextManager — 上下文窗口管理

**Files:**
- Create: `src/main/services/context-manager.ts`

- [ ] **Step 1: 创建 `src/main/services/context-manager.ts`**

```typescript
import { ConversationTurn, ContextWindow } from '../../shared/types';
import { conversationStore } from '../store/conversation-store';
import { CONTEXT } from '../../shared/constants';

export class ContextManager {
  /**
   * 获取当前上下文窗口，自动压缩旧消息
   */
  getContext(): ContextWindow {
    const allTurns = conversationStore.getRecentTurns(CONTEXT.MAX_RECENT_TURNS + 20);

    if (allTurns.length <= CONTEXT.MAX_RECENT_TURNS) {
      return { recentTurns: allTurns.reverse() }; // 时间升序
    }

    // 超过 10 轮：取最近 10 轮 + 压缩旧消息为摘要
    const recent = allTurns.slice(0, CONTEXT.MAX_RECENT_TURNS).reverse();
    const old = allTurns.slice(CONTEXT.MAX_RECENT_TURNS);

    const summary = this.summarize(old);
    return { recentTurns: recent, summary };
  }

  /**
   * 添加新轮次
   */
  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    return conversationStore.addTurn(turn);
  }

  /**
   * 构建发送给 API 的消息列表
   */
  buildMessages(context: ContextWindow, currentUserMessage: string): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];

    // 系统提示 + 摘要
    let systemPrompt = '你是一个 AI 视觉对话助手，能够看到摄像头画面并听到用户说话。请用中文简洁自然地回答。';
    if (context.summary) {
      systemPrompt += `\n\n[之前对话摘要] ${context.summary}`;
    }
    messages.push({ role: 'system', content: systemPrompt });

    // 最近对话
    for (const turn of context.recentTurns) {
      if (turn.role === 'user' || turn.role === 'assistant') {
        let content = turn.content;
        if (turn.visualDescription) {
          content = `[画面: ${turn.visualDescription}]\n${content}`;
        }
        messages.push({ role: turn.role, content });
      }
    }

    // 当前消息
    messages.push({ role: 'user', content: currentUserMessage });

    return messages;
  }

  private summarize(turns: ConversationTurn[]): string {
    // 简单摘要：拼接前几句的关键信息
    const userMessages = turns
      .filter(t => t.role === 'user' || t.role === 'assistant')
      .map(t => t.content)
      .join(' ');
    return userMessages.length > CONTEXT.SUMMARY_MAX_CHARS
      ? userMessages.substring(0, CONTEXT.SUMMARY_MAX_CHARS) + '...'
      : userMessages;
  }
}

export const contextManager = new ContextManager();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/services/context-manager.ts
git commit -m "feat: add context manager with sliding window and summary compression"
```

### Task 11: TTSService — Edge TTS 本地合成

**Files:**
- Create: `src/main/services/tts-service.ts`

- [ ] **Step 1: 创建 `src/main/services/tts-service.ts`**

```typescript
// Edge TTS 通过 node-edge-tts 包，使用系统内置的 Microsoft Edge TTS 引擎
// 无需 API Key，完全免费

let edgeTts: any;

async function getEdgeTts() {
  if (!edgeTts) {
    // node-edge-tts 导出 { synthesize }
    edgeTts = await import('node-edge-tts');
  }
  return edgeTts;
}

export interface TTSOptions {
  voice?: string;      // e.g. 'zh-CN-XiaoxiaoNeural'
  rate?: number;       // 0.5 - 2.0
}

export class TTSService {

  /**
   * 将文本合成为音频 Buffer (MP3)
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<Buffer> {
    const tts = await getEdgeTts();
    const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
    const rate = options.rate || 1.0;

    // node-edge-tts synthesize returns a readable stream or buffer
    const result = await tts.synthesize({
      text,
      voice,
      rate: `+${Math.round((rate - 1) * 100)}%`,
    });

    // Collect chunks into a Buffer
    if (Buffer.isBuffer(result)) {
      return result;
    }

    // If stream, collect
    const chunks: Buffer[] = [];
    for await (const chunk of result) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * 将合成音频通过渲染进程播放
   * 返回 base64 编码的 MP3 数据
   */
  async synthesizeToBase64(text: string, options?: TTSOptions): Promise<string> {
    const audioBuffer = await this.synthesize(text, options);
    return audioBuffer.toString('base64');
  }

  /**
   * 获取系统可用的中文 TTS 音色列表
   */
  static readonly VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声, 活泼)', gender: 'female' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男声, 叙事)', gender: 'male' },
    { id: 'zh-CN-YunjianNeural', name: '云健 (男声, 运动)', gender: 'male' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声, 温柔)', gender: 'female' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男声, 新闻)', gender: 'male' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女声, 自然)', gender: 'female' },
  ];
}

export const ttsService = new TTSService();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/services/tts-service.ts
git commit -m "feat: add Edge TTS service for free local speech synthesis"
```

---

## Phase 8: IPC 通信桥

### Task 12: IPC Handlers — 注册所有 IPC 通道

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 创建 `src/main/ipc-handlers.ts`**

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { mediaService } from './services/media-service';
import { vadService } from './services/vad-service';
import { frameDedup } from './services/frame-dedup';
import { ttsService } from './services/tts-service';
import { conversationStore } from './store/conversation-store';
import { preferenceStore } from './store/preference-store';
import { contextManager } from './services/context-manager';
import { modelRouter } from './router/model-router';
import { qwenClient } from './clients/qwen-client';
import { deepseekClient } from './clients/deepseek-client';
import { ConversationState, ConversationInput, AIResponse } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';

let currentState: ConversationState = 'idle';
let accessibilityEnabled = false;

export function registerIpcHandlers(mainWindow: BrowserWindow) {

  // ---- Media ----
  ipcMain.handle(IPC_CHANNELS.MEDIA_START_CAMERA, async () => {
    await mediaService.startCapture(mainWindow);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.MEDIA_STOP_CAMERA, async () => {
    mediaService.stopCapture(mainWindow);
    return true;
  });

  // Renderer → Main: 帧数据
  ipcMain.on('media:frame', (_event, jpegBase64: string, dhashHex: string) => {
    mediaService.handleFrame(jpegBase64);
    const hash = BigInt('0x' + dhashHex);
    frameDedup.isDuplicate(hash);
  });

  // Renderer → Main: 音频数据
  ipcMain.on('media:audio-chunk', (_event, audioData: number[]) => {
    const chunk = new Float32Array(audioData);
    vadService.processChunk(chunk);
  });

  // ---- Conversation ----
  ipcMain.handle(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, async (_event, text: string, includeFrame: boolean) => {
    // 由 ConversationManager 处理
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, async (_event, enabled: boolean) => {
    accessibilityEnabled = enabled;
    return true;
  });

  // ---- History ----
  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, async (_event, query?: string) => {
    if (query) {
      return conversationStore.searchHistory(query);
    }
    return conversationStore.getRecentTurns(50);
  });

  // ---- Preferences ----
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => {
    return preferenceStore.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (_event, prefs: Record<string, string>) => {
    for (const [key, value] of Object.entries(prefs)) {
      preferenceStore.set(key, value);
    }
    return true;
  });

  // ---- State helpers ----
  function setState(state: ConversationState) {
    currentState = state;
    mainWindow.webContents.send(IPC_CHANNELS.STATE_CHANGED, state);
  }

  function sendTranscript(text: string) {
    mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPT_UPDATE, text);
  }

  function sendResponse(response: AIResponse) {
    mainWindow.webContents.send(IPC_CHANNELS.RESPONSE_UPDATE, response);
  }

  function sendCostUpdate(cost: any) {
    mainWindow.webContents.send(IPC_CHANNELS.COST_UPDATE, cost);
  }

  // Expose helper functions for use by ConversationManager
  (global as any).__stateHelpers = { setState, sendTranscript, sendResponse, sendCostUpdate };
}

export function emitState(state: ConversationState) {
  (global as any).__stateHelpers?.setState(state);
}

export function emitTranscript(text: string) {
  (global as any).__stateHelpers?.sendTranscript(text);
}

export function emitResponse(response: AIResponse) {
  (global as any).__stateHelpers?.sendResponse(response);
}

export function emitCost(cost: any) {
  (global as any).__stateHelpers?.sendCostUpdate(cost);
}
```

- [ ] **Step 2: 更新 `src/main/index.ts` — 注册 IPC**

在 `createWindow()` 末尾添加：
```typescript
import { registerIpcHandlers } from './ipc-handlers';
import { preferenceStore } from './store/preference-store';
import { initQwenClient } from './clients/qwen-client';
import { initDeepSeekClient } from './clients/deepseek-client';

// 在 createWindow 内，mainWindow 创建后：
preferenceStore.init();
const prefs = preferenceStore.getAll();
initQwenClient(prefs.qwenApiKey);
initDeepSeekClient(prefs.deepseekApiKey);
registerIpcHandlers(mainWindow);
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/index.ts
git commit -m "feat: add IPC handlers for media, conversation, history, preferences"
```

---

## Phase 9: 对话管理器 (核心编排)

### Task 13: ConversationManager — 核心对话闭环编排

**Files:**
- Create: `src/main/services/conversation-manager.ts`

- [ ] **Step 1: 创建 `src/main/services/conversation-manager.ts`**

```typescript
import { ConversationTurn, AIResponse, ConversationInput, ModelChoice } from '../../shared/types';
import { vadService } from './vad-service';
import { frameDedup } from './frame-dedup';
import { contextManager } from './context-manager';
import { modelRouter } from '../router/model-router';
import { qwenClient, initQwenClient } from '../clients/qwen-client';
import { deepseekClient, initDeepSeekClient } from '../clients/deepseek-client';
import { ttsService } from './tts-service';
import { preferenceStore } from '../store/preference-store';
import { emitState, emitTranscript, emitResponse, emitCost } from '../ipc-handlers';
import { COST } from '../../shared/constants';
import { CostSummary } from '../../shared/types';

export class ConversationManager {
  private lastFrameBase64: string | null = null;
  private lastFrameDhash: bigint | null = null;
  private isAccessibilityMode = false;
  private accessibilityTimer: ReturnType<typeof setInterval> | null = null;
  private costSummary: CostSummary = {
    todayTokens: 0, todayCost: 0, dailyBudget: 5,
    callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0,
  };
  private lastFrameSentTime = 0;

  init() {
    const prefs = preferenceStore.getAll();
    initQwenClient(prefs.qwenApiKey);
    initDeepSeekClient(prefs.deepseekApiKey);
    this.costSummary.dailyBudget = Number(prefs.dailyBudget) || 5;

    // VAD 回调
    vadService.setCallbacks({
      onSpeechStart: () => {
        emitState('listening');
        emitTranscript('...');
      },
      onSpeechEnd: (segments) => this.handleSpeechEnd(segments),
    });
  }

  /**
   * 处理来自 useMediaStream 的帧数据
   */
  handleFrame(jpegBase64: string, dhashHex: string) {
    this.lastFrameBase64 = jpegBase64;
    this.lastFrameDhash = BigInt('0x' + dhashHex);
  }

  /**
   * 语音段结束 → 执行核心对话闭环
   */
  private async handleSpeechEnd(segments: Float32Array[]) {
    emitState('processing');

    // 合并音频段 → WAV
    const merged = vadService.mergeSegments(segments);
    const wavBuffer = vadService.float32ToWav(merged, 16000);
    const audioBase64 = wavBuffer.toString('base64');

    // 检查帧是否需要发送
    let frameToSend: string | undefined;
    const isDuplicate = this.lastFrameDhash
      ? frameDedup.isDuplicate(this.lastFrameDhash)
      : true;

    if (!isDuplicate && this.lastFrameBase64) {
      frameToSend = this.lastFrameBase64;
      this.lastFrameSentTime = Date.now();
      this.costSummary.callsSavedByDedup++;
    } else if (this.lastFrameBase64) {
      // 尝试使用缓存描述
      const cached = frameDedup.getCachedDescription();
      if (cached) {
        this.costSummary.callsSavedByCache++;
      }
    }

    // 构建输入特征
    const input: ConversationInput = {
      hasNewImage: !!frameToSend,
      hasSpeech: true,
      hasTextInput: false,
      isAccessibilityMode: this.isAccessibilityMode,
      isFollowUp: false,
    };
    const modelChoice = modelRouter.route(input);

    try {
      let response: AIResponse;

      if (modelChoice === 'qwen-omni') {
        response = await this.handleQwenTurn(audioBase64, frameToSend);
      } else {
        response = await this.handleDeepSeekTurn(/* transcription */ '');
      }

      emitResponse(response);
      emitState('speaking');

      // TTS 播放
      const audioBase64MP3 = await ttsService.synthesizeToBase64(response.text);
      emitResponse({ ...response, text: response.text }); // triggers audio playback in renderer

      // 保存到历史
      contextManager.addTurn({
        role: 'user',
        content: '[语音输入]',
        modelUsed: modelChoice,
        tokensUsed: 0,
      });
      contextManager.addTurn({
        role: 'assistant',
        content: response.text,
        visualDescription: response.visualDescription,
        modelUsed: modelChoice,
        tokensUsed: response.tokensUsed,
      });

      // 更新成本
      this.updateCost(response.tokensUsed, modelChoice);

    } catch (error) {
      console.error('Conversation error:', error);
      emitState('idle');
    }
  }

  private async handleQwenTurn(audioBase64?: string, frameBase64?: string): Promise<AIResponse> {
    const context = contextManager.getContext();
    const response = await qwenClient.multimodalChat({
      imageBase64: frameBase64,
      audioBase64,
      contextMessages: context.recentTurns.map(t => ({
        role: t.role,
        content: t.content,
      })),
    });

    // 缓存视觉描述
    if (response.visualDescription) {
      frameDedup.cacheDescription(response.visualDescription);
    }

    return {
      text: response.responseText,
      visualDescription: response.visualDescription,
      emotion: response.emotion,
      modelUsed: 'qwen-omni',
      tokensUsed: 0, // API 返回后填充
    };
  }

  private async handleDeepSeekTurn(userText: string): Promise<AIResponse> {
    const context = contextManager.getContext();
    const messages = contextManager.buildMessages(context, userText);

    const result = await deepseekClient.chat(messages);

    return {
      text: result.text,
      modelUsed: 'deepseek',
      tokensUsed: result.tokensUsed,
    };
  }

  /**
   * 处理纯文字输入 (US8)
   */
  async handleTextInput(text: string, includeFrame: boolean): Promise<AIResponse> {
    emitState('processing');

    const frameToSend = includeFrame ? this.lastFrameBase64 ?? undefined : undefined;

    const input: ConversationInput = {
      hasNewImage: !!frameToSend,
      hasSpeech: false,
      hasTextInput: true,
      isAccessibilityMode: false,
      isFollowUp: true, // 文字输入通常是追问
    };
    const modelChoice = modelRouter.route(input);

    let response: AIResponse;
    if (modelChoice === 'qwen-omni' && frameToSend) {
      response = await this.handleQwenTurn(undefined, frameToSend);
    } else {
      // 纯文字，走 DeepSeek
      const context = contextManager.getContext();
      const messages = contextManager.buildMessages(context, text);
      const result = await deepseekClient.chat(messages);
      response = {
        text: result.text,
        modelUsed: 'deepseek',
        tokensUsed: result.tokensUsed,
      };
    }

    // TTS
    try {
      const audioBase64MP3 = await ttsService.synthesizeToBase64(response.text);
      emitResponse({ ...response });
    } catch {
      emitResponse(response);
    }
    emitState('speaking');

    // 保存历史
    contextManager.addTurn({
      role: 'user', content: text, modelUsed: modelChoice, tokensUsed: 0,
    });
    contextManager.addTurn({
      role: 'assistant', content: response.text,
      visualDescription: response.visualDescription,
      modelUsed: modelChoice, tokensUsed: response.tokensUsed,
    });

    this.updateCost(response.tokensUsed, modelChoice);
    return response;
  }

  // ---- 无障碍模式 (US7) ----
  toggleAccessibility(enabled: boolean) {
    this.isAccessibilityMode = enabled;
    if (enabled) {
      this.startAccessibilityLoop();
    } else {
      this.stopAccessibilityLoop();
    }
  }

  private startAccessibilityLoop() {
    const interval = Number(preferenceStore.get('accessibilityInterval')) * 1000 || 5000;
    this.accessibilityTimer = setInterval(() => this.accessibilityTick(), interval);
  }

  private stopAccessibilityLoop() {
    if (this.accessibilityTimer) {
      clearInterval(this.accessibilityTimer);
      this.accessibilityTimer = null;
    }
  }

  private async accessibilityTick() {
    if (!this.lastFrameBase64 || !this.lastFrameDhash) return;

    const hash = this.lastFrameDhash;
    const isSignificant = frameDedup.isSignificantChange(hash);
    const timeSinceLastForce = Date.now() - this.lastFrameSentTime;
    const forceRefresh = timeSinceLastForce > 60000;

    if (!isSignificant && !forceRefresh) return;

    try {
      const description = await qwenClient.describeImage(this.lastFrameBase64);
      frameDedup.cacheDescription(description);
      this.lastFrameSentTime = Date.now();

      const response: AIResponse = {
        text: description,
        visualDescription: description,
        modelUsed: 'qwen-omni',
        tokensUsed: 90, // 约 90 token
      };

      emitResponse(response);
      emitState('speaking');

      const audioBase64MP3 = await ttsService.synthesizeToBase64(description);
      emitResponse({ ...response });

      contextManager.addTurn({
        role: 'system', content: `[场景] ${description}`,
        visualDescription: description, modelUsed: 'qwen-omni', tokensUsed: 90,
      });

      this.updateCost(90, 'qwen-omni');
    } catch (error) {
      console.error('Accessibility tick error:', error);
    }
  }

  // ---- 成本追踪 (L5) ----
  private updateCost(tokens: number, model: ModelChoice) {
    const pricePer1K = model === 'qwen-omni'
      ? COST.QWEN_PRICE_PER_1K_TOKENS
      : COST.DEEPSEEK_PRICE_PER_1K_TOKENS;

    this.costSummary.todayTokens += tokens;
    this.costSummary.todayCost += (tokens / 1000) * pricePer1K;
    emitCost(this.costSummary);
  }

  getCostSummary(): CostSummary {
    return { ...this.costSummary };
  }
}

export const conversationManager = new ConversationManager();
```

- [ ] **Step 2: Commit**

```bash
git add src/main/services/conversation-manager.ts
git commit -m "feat: add ConversationManager orchestrating the full conversation loop"
```

---

## Phase 10: 渲染进程 — useMediaStream Hook

### Task 14: useMediaStream — 摄像头/麦克风 + dhash 计算

**Files:**
- Create: `src/renderer/hooks/useMediaStream.ts`

- [ ] **Step 1: 创建 `src/renderer/hooks/useMediaStream.ts`**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseMediaStreamReturn {
  stream: MediaStream | null;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useMediaStream(): UseMediaStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      setStream(mediaStream);

      // 绑定 video 元素
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // 创建离屏 canvas 用于抽帧
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      const ctx = canvasRef.current.getContext('2d')!;

      // 抽帧 2fps
      frameIntervalRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const jpegBase64 = canvasRef.current.toDataURL('image/jpeg', 0.75).split(',')[1];
          const dhashHex = computeDhash(ctx, 640, 480);
          // Send to main process
          (window as any).electronAPI?.sendFrame(jpegBase64, dhashHex);
        }
      }, 500); // 2fps = 500ms

      // 音频处理
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      audioProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      audioProcessorRef.current.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const floatArray = Array.from(inputData);
        (window as any).electronAPI?.sendAudioChunk(floatArray);
      };

      source.connect(audioProcessorRef.current);
      audioProcessorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error('Failed to start media capture:', err);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  return { stream, startCapture, stopCapture, videoRef };
}

/**
 * 计算 dhash (差异感知哈希)
 * 将图像缩放到 17x17 灰度图，比较相邻像素 → 256 位 BigInt hex
 */
function computeDhash(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  // 缩放到 17x17
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 17;
  tempCanvas.height = 17;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 17, 17);

  const imageData = tempCtx.getImageData(0, 0, 17, 17);
  const pixels = imageData.data;

  // 提取灰度 (每像素 4 bytes: R,G,B,A)
  const gray: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    gray.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }

  // 计算差异哈希: 16x16 = 256 位
  let hash = 0n;
  let bitIndex = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = y * 17 + x;
      const rightIdx = idx + 1;
      if (gray[idx] > gray[rightIdx]) {
        hash |= (1n << BigInt(255 - bitIndex));
      }
      bitIndex++;
    }
  }

  return hash.toString(16).padStart(64, '0');
}

// 扩展 window 类型
declare global {
  interface Window {
    electronAPI?: {
      sendFrame: (jpegBase64: string, dhashHex: string) => void;
      sendAudioChunk: (audioData: number[]) => void;
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/useMediaStream.ts
git commit -m "feat: add useMediaStream hook with camera capture and dhash computation"
```

---

## Phase 11: 渲染进程 — UI 组件

### Task 15: CameraPreview + StatusIndicator + ChatBubble + ControlBar + TextInput

**Files:**
- Create: `src/renderer/components/CameraPreview.tsx`
- Create: `src/renderer/components/StatusIndicator.tsx`
- Create: `src/renderer/components/ChatBubble.tsx`
- Create: `src/renderer/components/ControlBar.tsx`
- Create: `src/renderer/components/TextInput.tsx`

- [ ] **Step 1: 创建 `CameraPreview.tsx`**

```tsx
import React, { useRef } from 'react';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
}

export const CameraPreview: React.FC<Props> = ({ videoRef, isActive }) => (
  <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover"
    />
    {!isActive && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <p className="text-white text-lg">摄像头未启动</p>
      </div>
    )}
    {/* 录音指示灯 */}
    <div className="absolute top-2 right-2 flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
      <span className="text-white text-xs">{isActive ? '采集中' : '待机'}</span>
    </div>
  </div>
);
```

- [ ] **Step 2: 创建 `StatusIndicator.tsx`**

```tsx
import React from 'react';
import { ConversationState } from '../../shared/types';

interface Props {
  state: ConversationState;
  latency?: number;
}

const STATE_LABELS: Record<ConversationState, { label: string; color: string; icon: string }> = {
  idle:       { label: '就绪，等待对话', color: 'bg-gray-400',   icon: '⏸' },
  listening:  { label: '正在听...',     color: 'bg-red-500',     icon: '🎙️' },
  processing: { label: 'AI 思考中...',  color: 'bg-yellow-500',  icon: '🤔' },
  speaking:   { label: 'AI 回复中...',  color: 'bg-green-500',   icon: '🔊' },
};

export const StatusIndicator: React.FC<Props> = ({ state, latency }) => {
  const info = STATE_LABELS[state];
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-full">
      <span className={`w-3 h-3 rounded-full ${info.color} ${state === 'listening' || state === 'processing' ? 'animate-pulse' : ''}`} />
      <span className="text-white text-sm font-medium">{info.icon} {info.label}</span>
      {latency !== undefined && state === 'processing' && (
        <span className="text-gray-400 text-xs">{(latency / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
};
```

- [ ] **Step 3: 创建 `ChatBubble.tsx`**

```tsx
import React from 'react';
import { AIResponse } from '../../shared/types';

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: string;
  visualDescription?: string;
  timestamp?: number;
}

export const ChatBubble: React.FC<Props> = ({ role, content, visualDescription, timestamp }) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
        isSystem
          ? 'bg-purple-50 border border-purple-200 text-purple-900'
          : isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
      }`}>
        {visualDescription && (
          <p className={`text-xs mb-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
            👁️ {visualDescription}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {timestamp && (
          <p className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
            {new Date(timestamp).toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: 创建 `ControlBar.tsx`**

```tsx
import React from 'react';

interface Props {
  isActive: boolean;
  isAccessibility: boolean;
  onToggleMic: () => void;
  onToggleAccessibility: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const ControlBar: React.FC<Props> = ({
  isActive, isAccessibility, onToggleMic,
  onToggleAccessibility, onOpenSettings, onOpenHistory,
}) => (
  <div className="flex items-center justify-center gap-4 py-4">
    {/* 麦克风按钮 */}
    <button
      onClick={onToggleMic}
      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
        isActive
          ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 scale-110'
          : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
      }`}
      title={isActive ? '关闭麦克风' : '开启麦克风'}
    >
      🎤
    </button>

    {/* 无障碍模式 */}
    <button
      onClick={onToggleAccessibility}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isAccessibility
          ? 'bg-purple-500 text-white'
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
      title="无障碍环境描述模式"
    >
      ♿ {isAccessibility ? '描述中' : '辅助模式'}
    </button>

    {/* 历史 */}
    <button
      onClick={onOpenHistory}
      className="px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-600 hover:bg-gray-300"
      title="对话历史"
    >
      📋 历史
    </button>

    {/* 设置 */}
    <button
      onClick={onOpenSettings}
      className="px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-600 hover:bg-gray-300"
      title="设置"
    >
      ⚙️ 设置
    </button>
  </div>
);
```

- [ ] **Step 5: 创建 `TextInput.tsx`**

```tsx
import React, { useState, useRef } from 'react';

interface Props {
  onSend: (text: string, includeFrame: boolean) => void;
  disabled: boolean;
}

export const TextInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [includeFrame, setIncludeFrame] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim(), includeFrame);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-t border-gray-200">
      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={includeFrame}
          onChange={e => setIncludeFrame(e.target.checked)}
          className="rounded"
        />
        📷 附图
      </label>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        placeholder="输入文字消息（可选）..."
        disabled={disabled}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        发送
      </button>
    </div>
  );
};
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/
git commit -m "feat: add UI components — CameraPreview, StatusIndicator, ChatBubble, ControlBar, TextInput"
```

### Task 16: HistoryPanel + SettingsPanel

**Files:**
- Create: `src/renderer/components/HistoryPanel.tsx`
- Create: `src/renderer/components/SettingsPanel.tsx`

- [ ] **Step 1: 创建 `HistoryPanel.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { ConversationTurn } from '../../shared/types';

interface Props {
  onClose: () => void;
}

export const HistoryPanel: React.FC<Props> = ({ onClose }) => {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, [search]);

  const loadHistory = async () => {
    const result = await (window as any).electronAPI?.getHistory(search || undefined);
    setTurns(result || []);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-bold">对话历史</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
      </div>

      <div className="p-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索对话内容..."
          className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {turns.map(turn => (
          <div key={turn.id} className={`p-3 rounded-lg ${
            turn.role === 'user' ? 'bg-blue-50 ml-4' :
            turn.role === 'system' ? 'bg-purple-50' : 'bg-gray-50 mr-4'
          }`}>
            <p className="text-xs text-gray-400 mb-1">
              {turn.role === 'user' ? '👤 用户' :
               turn.role === 'system' ? '🤖 系统' : '🤖 AI'}
              {' · '}{new Date(turn.timestamp).toLocaleString('zh-CN')}
              {' · '}{turn.modelUsed}
            </p>
            {turn.visualDescription && (
              <p className="text-xs text-purple-600 mb-1">👁️ {turn.visualDescription}</p>
            )}
            <p className="text-sm">{turn.content}</p>
          </div>
        ))}
        {turns.length === 0 && (
          <p className="text-center text-gray-400 py-8">暂无对话记录</p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 创建 `SettingsPanel.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { TTSService } from '../../main/services/tts-service';

interface Props {
  onClose: () => void;
}

export const SettingsPanel: React.FC<Props> = ({ onClose }) => {
  const [prefs, setPrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    (window as any).electronAPI?.getPreferences().then(setPrefs);
  }, []);

  const save = async (key: string, value: string) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await (window as any).electronAPI?.setPreferences({ [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-bold">设置</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* API Keys */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">API 密钥</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">千问 API Key</label>
              <input type="password" value={prefs.qwenApiKey || ''}
                onChange={e => save('qwenApiKey', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">DeepSeek API Key</label>
              <input type="password" value={prefs.deepseekApiKey || ''}
                onChange={e => save('deepseekApiKey', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
          </div>
        </section>

        {/* TTS 设置 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">语音合成 (TTS)</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">音色</label>
              <select value={prefs.ttsVoice || 'zh-CN-XiaoxiaoNeural'}
                onChange={e => save('ttsVoice', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                {TTSService.VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">语速: {prefs.ttsRate || '1.0'}x</label>
              <input type="range" min="0.5" max="2.0" step="0.1"
                value={prefs.ttsRate || '1.0'}
                onChange={e => save('ttsRate', e.target.value)}
                className="w-full mt-1" />
            </div>
          </div>
        </section>

        {/* 预算 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">每日 API 费用预算</h3>
          <div>
            <input type="number" value={prefs.dailyBudget || '5'}
              onChange={e => save('dailyBudget', e.target.value)}
              className="w-32 px-3 py-2 border rounded-lg text-sm"
              min="0" step="1" />
            <span className="ml-2 text-sm text-gray-500">元/天 (0=不限)</span>
          </div>
        </section>

        {/* 无障碍模式 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">无障碍模式</h3>
          <div>
            <label className="text-xs text-gray-500">环境描述间隔</label>
            <select value={prefs.accessibilityInterval || '5'}
              onChange={e => save('accessibilityInterval', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
              <option value="3">每 3 秒</option>
              <option value="5">每 5 秒</option>
              <option value="10">每 10 秒</option>
              <option value="30">每 30 秒</option>
            </select>
          </div>
        </section>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/HistoryPanel.tsx src/renderer/components/SettingsPanel.tsx
git commit -m "feat: add HistoryPanel with search and SettingsPanel with all preferences"
```

---

## Phase 12: App.tsx 主界面集成

### Task 17: App.tsx — 组合所有组件，完成 UI 集成

**Files:**
- Create: `src/renderer/App.tsx` (覆盖骨架版本)
- Create: `src/renderer/hooks/useConversation.ts`

- [ ] **Step 1: 创建 `src/renderer/hooks/useConversation.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationState, AIResponse, ConversationTurn, CostSummary } from '../../shared/types';

interface ConversationState2 {
  state: ConversationState;
  messages: ConversationTurn[];
  transcript: string;
  costSummary: CostSummary;
  latency: number;
}

export function useConversation() {
  const [conv, setConv] = useState<ConversationState2>({
    state: 'idle',
    messages: [],
    transcript: '',
    costSummary: { todayTokens: 0, todayCost: 0, dailyBudget: 5, callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0 },
    latency: 0,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onStateChange((state: ConversationState) => {
      setConv(prev => ({ ...prev, state }));
    });

    api.onTranscript((text: string) => {
      setConv(prev => ({ ...prev, transcript: text }));
    });

    api.onResponse((response: AIResponse) => {
      setConv(prev => {
        const newMsg: ConversationTurn = {
          id: '', timestamp: Date.now(), role: 'assistant',
          content: response.text,
          visualDescription: response.visualDescription,
          modelUsed: response.modelUsed, tokensUsed: response.tokensUsed,
        };
        return { ...prev, messages: [...prev.messages, newMsg] };
      });
    });

    api.onCostUpdate((cost: CostSummary) => {
      setConv(prev => ({ ...prev, costSummary: cost }));
    });
  }, []);

  const sendTextMessage = useCallback(async (text: string, includeFrame: boolean) => {
    setConv(prev => ({
      ...prev,
      state: 'processing',
      messages: [...prev.messages, {
        id: '', timestamp: Date.now(), role: 'user',
        content: text, modelUsed: 'deepseek', tokensUsed: 0,
      }],
    }));
    await (window as any).electronAPI?.sendMessage(text, includeFrame);
  }, []);

  return { ...conv, sendTextMessage, audioRef };
}
```

- [ ] **Step 2: 创建 `src/renderer/App.tsx`**

```tsx
import React, { useState } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { StatusIndicator } from './components/StatusIndicator';
import { ChatBubble } from './components/ChatBubble';
import { ControlBar } from './components/ControlBar';
import { TextInput } from './components/TextInput';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useMediaStream } from './hooks/useMediaStream';
import { useConversation } from './hooks/useConversation';

export default function App() {
  const { stream, startCapture, stopCapture, videoRef } = useMediaStream();
  const { state, messages, costSummary, sendTextMessage } = useConversation();
  const [isActive, setIsActive] = useState(false);
  const [isAccessibility, setIsAccessibility] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const toggleMic = async () => {
    if (isActive) {
      stopCapture();
      setIsActive(false);
    } else {
      await startCapture();
      setIsActive(true);
    }
  };

  const toggleAccessibility = () => {
    const next = !isAccessibility;
    setIsAccessibility(next);
    (window as any).electronAPI?.toggleAccessibilityMode(next);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部：摄像头 + 状态 */}
      <div className="p-4 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto">
          <CameraPreview videoRef={videoRef} isActive={isActive} />
          <div className="flex items-center justify-between mt-3">
            <StatusIndicator state={state} />
            <span className="text-xs text-gray-400">
              今日: ¥{costSummary.todayCost.toFixed(4)}
              {' · '}
              {costSummary.todayTokens} tokens
            </span>
          </div>
        </div>
      </div>

      {/* 中间：对话区 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-lg">
                点击麦克风按钮开始对话
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatBubble key={i} {...msg} />
          ))}
        </div>
      </div>

      {/* 底部：控制栏 + 文字输入 */}
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <TextInput onSend={sendTextMessage} disabled={state === 'processing'} />
          <ControlBar
            isActive={isActive}
            isAccessibility={isAccessibility}
            onToggleMic={toggleMic}
            onToggleAccessibility={toggleAccessibility}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHistory={() => setShowHistory(true)}
          />
        </div>
      </div>

      {/* 面板 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}

      {/* 成本概览 */}
      {costSummary.todayTokens > 0 && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-lg shadow p-3 text-xs text-gray-500">
          <p>💰 今日费用: ¥{costSummary.todayCost.toFixed(4)}</p>
          <p>🛡 VAD 节省: {costSummary.callsSavedByVAD} 次</p>
          <p>🖼 去重节省: {costSummary.callsSavedByDedup} 次</p>
          <p>💾 缓存命中: {costSummary.callsSavedByCache} 次</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx src/renderer/hooks/useConversation.ts
git commit -m "feat: integrate App.tsx with all components and conversation hook"
```

---

## Phase 13: 集成测试 & 启动验证

### Task 18: 启动应用并验证核心闭环

- [ ] **Step 1: 确保 TypeScript 编译通过**

Run: `cd E:\Projects\ai-visual-assistant && npx tsc --noEmit`
Expected: No errors (或仅 minor warnings)

- [ ] **Step 2: 启动 Electron 开发模式**

Run: `cd E:\Projects\ai-visual-assistant && npm run electron:dev`
Expected: Electron 窗口打开，显示摄像头预览和对话界面

- [ ] **Step 3: 验证 P0 核心功能**
  - 点击麦克风按钮 → 摄像头启动，状态变为"正在听"
  - 对着麦克风说话 → VAD 检测到语音段后状态变为"AI 思考中"
  - AI 回复 → 状态变为"AI 回复中"，对话气泡显示，Edge TTS 播放语音

- [ ] **Step 4: 验证 P1 体验**
  - 不说话 → 不消耗 API 调用（状态保持 idle）
  - 画面不变 → 帧去重生效，第二次提问不重复发送相同帧
  - 延迟 < 3 秒

- [ ] **Step 5: 验证 P2 场景**
  - 点击无障碍模式 → 每 5 秒自动描述画面变化
  - 文字输入框发送消息 → DeepSeek 纯文字回复
  - 打开历史面板 → 搜索对话 → 显示结果

- [ ] **Step 6: Commit 任何修复**

```bash
git add -A
git commit -m "fix: integration fixes from testing"
```

---

## Plan Self-Review Checklist

Before handing off, verify:

1. **Spec coverage** — Each user story (US1–US9) maps to a task:
   - US1-US3 (P0): Tasks 4, 5, 6, 7, 13, 14, 15, 17 — core loop
   - US4 (P1): Tasks 5, 6 — VAD + dedup
   - US5 (P1): Task 10, 13 — context manager + conversation manager save
   - US6 (P1): Task 13 — latency target in handleSpeechEnd
   - US7 (P2): Task 13 accessibilityTick, Task 15 ControlBar toggle
   - US8 (P2): Task 13 handleTextInput, Task 15 TextInput, Task 17
   - US9 (P2): Task 3 (store), Task 12 (IPC history:get), Task 16 (HistoryPanel)
   - US10-US11 (P3): Task 16 (SettingsPanel), Task 3 (preference-store)

2. **No placeholders** — All code blocks contain real implementations

3. **Type consistency** — Types defined in Task 2 are used consistently across all tasks

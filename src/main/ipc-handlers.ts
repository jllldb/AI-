import { ipcMain, BrowserWindow, session } from 'electron';
import { vadService } from './services/vad-service';
import { conversationStore } from './store/conversation-store';
import { preferenceStore } from './store/preference-store';
import { ConversationState } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';

let stateSender: ((state: ConversationState) => void) | null = null;
let transcriptSender: ((text: string) => void) | null = null;
let responseSender: ((response: any) => void) | null = null;
let costSender: ((cost: any) => void) | null = null;
let audioLevelSender: ((level: number) => void) | null = null;

// Lazy ref to avoid circular dependency with conversation-manager
let _cm: any = null;
function getCM() {
  if (!_cm) _cm = require('./services/conversation-manager').conversationManager;
  return _cm;
}

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  stateSender = (s) => mainWindow.webContents.send(IPC_CHANNELS.STATE_CHANGED, s);
  transcriptSender = (t) => mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPT_UPDATE, t);
  responseSender = (r) => mainWindow.webContents.send(IPC_CHANNELS.RESPONSE_UPDATE, r);
  costSender = (c) => mainWindow.webContents.send(IPC_CHANNELS.COST_UPDATE, c);
  audioLevelSender = (l) => mainWindow.webContents.send('audio:level', l);

  // ---- Camera/Mic Permission (CRITICAL for getUserMedia) ----
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'camera', 'microphone'];
      callback(allowed.includes(permission));
    }
  );

  // ---- Media ----
  ipcMain.handle(IPC_CHANNELS.MEDIA_START_CAMERA, async () => true);
  ipcMain.handle(IPC_CHANNELS.MEDIA_STOP_CAMERA, async () => true);

  // 🔧 FIX: Route frames → ConversationManager (was broken: frames never reached CM)
  ipcMain.on('media:frame', (_e, jpegBase64: string, dhashHex: string) => {
    getCM().handleFrame(jpegBase64, dhashHex);
  });

  ipcMain.on('media:audio-chunk', (_e, audioData: number[]) => {
    const chunk = new Float32Array(audioData);
    const { rmsDb } = vadService.processChunk(chunk);
    // Send audio level to renderer (normalize -60..0 dB to 0..100)
    const level = Math.max(0, Math.min(100, (rmsDb + 60) * 100 / 60));
    if (audioLevelSender) audioLevelSender(Math.round(level));
  });

  // ---- Conversation ----
  ipcMain.handle(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, async (_e, text: string, includeFrame: boolean) => {
    return await getCM().handleTextInput(text, includeFrame);
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, async (_e, enabled: boolean) => {
    getCM().toggleAccessibility(enabled);
    return true;
  });

  // ---- History ----
  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, async (_e, query?: string) => {
    if (query) return conversationStore.searchHistory(query);
    return conversationStore.getRecentTurns(50);
  });

  // ---- Preferences ----
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => preferenceStore.getAll());
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (_e, prefs: Record<string, string>) => {
    for (const [k, v] of Object.entries(prefs)) preferenceStore.set(k, v);
    // Reload ALL clients and conversation manager config
    const { qwenClient, initQwenClient } = require('./clients/qwen-client');
    const { deepseekClient, initDeepSeekClient } = require('./clients/deepseek-client');
    const { openaiClient, initOpenAIClient } = require('./clients/openai-client');
    const { geminiClient, initGeminiClient } = require('./clients/gemini-client');
    const { claudeClient, initClaudeClient } = require('./clients/claude-client');
    initQwenClient(prefs.qwenApiKey || '');
    initDeepSeekClient(prefs.deepseekApiKey || '');
    initOpenAIClient(prefs.openaiApiKey || '');
    initGeminiClient(prefs.geminiApiKey || '');
    initClaudeClient(prefs.claudeApiKey || '');
    // Notify conversation manager to reload routing
    getCM().reloadConfig();
    return true;
  });
}

export function emitState(state: ConversationState) { stateSender?.(state); }
export function emitTranscript(text: string) { transcriptSender?.(text); }
export function emitResponse(response: any) { responseSender?.(response); }
export function emitCost(cost: any) { costSender?.(cost); }
export function emitAudioLevel(level: number) { audioLevelSender?.(level); }

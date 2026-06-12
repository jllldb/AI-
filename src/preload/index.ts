import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type { ConversationState, AIResponse, CostSummary, ConversationTurn } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Media
  startCamera: () => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_START_CAMERA),
  stopCamera: () => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_STOP_CAMERA),
  sendFrame: (jpegBase64: string, dhashHex: string) =>
    ipcRenderer.send('media:frame', jpegBase64, dhashHex),
  sendAudioChunk: (audioData: number[]) =>
    ipcRenderer.send('media:audio-chunk', audioData),

  // Conversation
  sendMessage: (text: string, includeFrame: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, text, includeFrame),
  toggleAccessibilityMode: (enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, enabled),

  // State subscriptions
  onStateChange: (cb: (s: ConversationState) => void) =>
    { ipcRenderer.on(IPC_CHANNELS.STATE_CHANGED, (_e, s) => cb(s)); },
  onTranscript: (cb: (t: string) => void) =>
    { ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_UPDATE, (_e, t) => cb(t)); },
  onResponse: (cb: (r: AIResponse) => void) =>
    { ipcRenderer.on(IPC_CHANNELS.RESPONSE_UPDATE, (_e, r) => cb(r)); },
  onCostUpdate: (cb: (c: CostSummary) => void) =>
    { ipcRenderer.on(IPC_CHANNELS.COST_UPDATE, (_e, c) => cb(c)); },

  // History
  getHistory: (query?: string): Promise<ConversationTurn[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, query),

  // Preferences
  getPreferences: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
  setPreferences: (prefs: Record<string, string>): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, prefs),
});

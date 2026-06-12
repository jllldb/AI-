import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- Media ----
  startCamera: () => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_START_CAMERA),
  stopCamera: () => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_STOP_CAMERA),
  sendFrame: (jpegBase64: string, dhashHex: string) =>
    ipcRenderer.send('media:frame', jpegBase64, dhashHex),
  sendAudioChunk: (audioData: number[]) =>
    ipcRenderer.send('media:audio-chunk', audioData),

  // ---- Conversation ----
  sendMessage: (text: string, includeFrame: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, text, includeFrame),
  toggleAccessibilityMode: (enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, enabled),

  // ---- State subscriptions (each returns a cleanup function) ----
  onStateChange: (cb: (s: string) => void): (() => void) => {
    const handler = (_e: unknown, s: string): void => { cb(s); };
    ipcRenderer.on(IPC_CHANNELS.STATE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATE_CHANGED, handler);
  },
  onTranscript: (cb: (t: string) => void): (() => void) => {
    const handler = (_e: unknown, t: string): void => { cb(t); };
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_UPDATE, handler);
  },
  onResponse: (cb: (r: unknown) => void): (() => void) => {
    const handler = (_e: unknown, r: unknown): void => { cb(r); };
    ipcRenderer.on(IPC_CHANNELS.RESPONSE_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RESPONSE_UPDATE, handler);
  },
  onCostUpdate: (cb: (c: unknown) => void): (() => void) => {
    const handler = (_e: unknown, c: unknown): void => { cb(c); };
    ipcRenderer.on(IPC_CHANNELS.COST_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COST_UPDATE, handler);
  },
  onAudioLevel: (cb: (l: number) => void): (() => void) => {
    const handler = (_e: unknown, l: number): void => { cb(l); };
    ipcRenderer.on('audio:level', handler);
    return () => ipcRenderer.removeListener('audio:level', handler);
  },

  // ---- History ----
  getHistory: (query?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, query),

  // ---- Preferences ----
  getPreferences: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
  setPreferences: (prefs: Record<string, string>) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, prefs),
});

import { contextBridge, ipcRenderer } from 'electron';

// Preload self-test: log that we're executing
console.log('[Preload] Starting preload script...');

// INLINE constants — can't rely on require() in preload sandbox
const IPC = {
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
};

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Media
    startCamera: () => ipcRenderer.invoke(IPC.MEDIA_START_CAMERA),
    stopCamera: () => ipcRenderer.invoke(IPC.MEDIA_STOP_CAMERA),
    sendFrame: (jpegBase64: string, dhashHex: string) =>
      ipcRenderer.send('media:frame', jpegBase64, dhashHex),
    sendAudioChunk: (audioData: number[]) =>
      ipcRenderer.send('media:audio-chunk', audioData),

    // Conversation
    sendMessage: (text: string, includeFrame: boolean) =>
      ipcRenderer.invoke(IPC.CONVERSATION_SEND_MESSAGE, text, includeFrame),
    toggleAccessibilityMode: (enabled: boolean) =>
      ipcRenderer.invoke(IPC.CONVERSATION_TOGGLE_ACCESSIBILITY, enabled),

    // State subscriptions
    onStateChange: (cb: (s: string) => void) =>
      { ipcRenderer.on(IPC.STATE_CHANGED, (_e, s) => cb(s)); },
    onTranscript: (cb: (t: string) => void) =>
      { ipcRenderer.on(IPC.TRANSCRIPT_UPDATE, (_e, t) => cb(t)); },
    onResponse: (cb: (r: any) => void) =>
      { ipcRenderer.on(IPC.RESPONSE_UPDATE, (_e, r) => cb(r)); },
    onCostUpdate: (cb: (c: any) => void) =>
      { ipcRenderer.on(IPC.COST_UPDATE, (_e, c) => cb(c)); },
    onAudioLevel: (cb: (l: number) => void) =>
      { ipcRenderer.on('audio:level', (_e, l) => cb(l)); },

    // History
    getHistory: (query?: string): Promise<any[]> =>
      ipcRenderer.invoke(IPC.HISTORY_GET, query),

    // Preferences
    getPreferences: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.PREFERENCES_GET),
    setPreferences: (prefs: Record<string, string>): Promise<boolean> =>
      ipcRenderer.invoke(IPC.PREFERENCES_SET, prefs),

    // Continuous mode
    setConvMode: (mode: string) => ipcRenderer.send('conv:mode', mode),

    // Transcription
    transcribeAudio: (audioBase64: string): Promise<{ text: string; error: string | null }> =>
      ipcRenderer.invoke('transcribe:audio', audioBase64),
  });
  console.log('[Preload] electronAPI exposed successfully');
} catch (err: any) {
  console.error('[Preload] Failed to expose electronAPI:', err.message, err.stack);
}

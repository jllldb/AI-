import { ipcMain, BrowserWindow, session } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { Container } from '../di/container';
import { TYPES } from '../core/tokens';
import type {
  IConversationOrchestrator, IVADService,
  IConversationStore, IPreferenceStore,
} from '../core/interfaces';

export function registerIpcHandlers(mainWindow: BrowserWindow, container: Container): void {
  const orchestrator = container.resolve<IConversationOrchestrator>(TYPES.ConversationOrchestrator);
  const vadService = container.resolve<IVADService>(TYPES.VADService);
  const conversationStore = container.resolve<IConversationStore>(TYPES.ConversationStore);
  const preferenceStore = container.resolve<IPreferenceStore>(TYPES.PreferenceStore);

  // ---- Camera/Mic Permission ----
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'camera', 'microphone'];
      callback(allowed.includes(permission));
    }
  );

  // ---- Media ----
  ipcMain.handle(IPC_CHANNELS.MEDIA_START_CAMERA, async () => true);
  ipcMain.handle(IPC_CHANNELS.MEDIA_STOP_CAMERA, async () => true);

  ipcMain.on('media:frame', (_e, jpegBase64: string, dhashHex: string) => {
    orchestrator.handleFrame(jpegBase64, dhashHex);
  });

  ipcMain.on('media:audio-chunk', (_e, audioData: number[]) => {
    const chunk = new Float32Array(audioData);
    const { rmsDb } = vadService.processChunk(chunk);
    const level = Math.max(0, Math.min(100, (rmsDb + 60) * 100 / 60));
    const emitter = container.resolve(TYPES.IpcEmitter);
    emitter.emitAudioLevel(Math.round(level));
  });

  // ---- Conversation ----
  ipcMain.handle(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, async (_e, text: string, includeFrame: boolean) => {
    return orchestrator.handleTextInput(text, includeFrame);
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, async (_e, enabled: boolean) => {
    orchestrator.toggleAccessibility(enabled);
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
    // Hot-reload provider configs when API keys change
    const providerFactory = container.resolve(TYPES.ProviderFactory);
    const candidates = ['qwen', 'deepseek', 'openai', 'gemini', 'claude'] as const;
    for (const name of candidates) {
      if (prefs[name + 'ApiKey'] || prefs[name + 'Model']) {
        providerFactory.reloadConfig(name);
      }
    }
    return true;
  });
}

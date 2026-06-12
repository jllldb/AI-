import { ipcMain, BrowserWindow } from 'electron';
import { mediaService } from './services/media-service';
import { vadService } from './services/vad-service';
import { frameDedup } from './services/frame-dedup';
import { conversationStore } from './store/conversation-store';
import { preferenceStore } from './store/preference-store';
import { ConversationState } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';

let currentState: ConversationState = 'idle';
let stateSender: ((state: ConversationState) => void) | null = null;
let transcriptSender: ((text: string) => void) | null = null;
let responseSender: ((response: any) => void) | null = null;
let costSender: ((cost: any) => void) | null = null;

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  stateSender = (s) => mainWindow.webContents.send(IPC_CHANNELS.STATE_CHANGED, s);
  transcriptSender = (t) => mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPT_UPDATE, t);
  responseSender = (r) => mainWindow.webContents.send(IPC_CHANNELS.RESPONSE_UPDATE, r);
  costSender = (c) => mainWindow.webContents.send(IPC_CHANNELS.COST_UPDATE, c);

  ipcMain.handle(IPC_CHANNELS.MEDIA_START_CAMERA, async () => {
    await mediaService.startCapture(mainWindow);
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.MEDIA_STOP_CAMERA, async () => {
    mediaService.stopCapture(mainWindow);
    return true;
  });

  ipcMain.on('media:frame', (_e, jpegBase64: string, dhashHex: string) => {
    mediaService.handleFrame(jpegBase64);
    const hash = BigInt('0x' + dhashHex);
    frameDedup.isDuplicate(hash);
  });

  ipcMain.on('media:audio-chunk', (_e, audioData: number[]) => {
    vadService.processChunk(new Float32Array(audioData));
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATION_SEND_MESSAGE, async (_e, text: string, includeFrame: boolean) => {
    const { conversationManager } = require('./services/conversation-manager');
    const response = await conversationManager.handleTextInput(text, includeFrame);
    return response;
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATION_TOGGLE_ACCESSIBILITY, async (_e, enabled: boolean) => {
    const { conversationManager } = require('./services/conversation-manager');
    conversationManager.toggleAccessibility(enabled);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, async (_e, query?: string) => {
    if (query) return conversationStore.searchHistory(query);
    return conversationStore.getRecentTurns(50);
  });

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => preferenceStore.getAll());
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_SET, async (_e, prefs: Record<string, string>) => {
    for (const [k, v] of Object.entries(prefs)) preferenceStore.set(k, v);
    return true;
  });
}

export function emitState(state: ConversationState) { stateSender?.(state); }
export function emitTranscript(text: string) { transcriptSender?.(text); }
export function emitResponse(response: any) { responseSender?.(response); }
export function emitCost(cost: any) { costSender?.(cost); }

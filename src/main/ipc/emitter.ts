import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { ConversationState, AIResponse, CostSummary } from '../../shared/types';
import type { IIpcEmitter } from '../core/interfaces';

export class IpcEmitter implements IIpcEmitter {
  private win: BrowserWindow | null = null;

  setWindow(win: BrowserWindow): void { this.win = win; }

  emitState(state: ConversationState): void {
    this.win?.webContents.send(IPC_CHANNELS.STATE_CHANGED, state);
  }

  emitTranscript(text: string): void {
    this.win?.webContents.send(IPC_CHANNELS.TRANSCRIPT_UPDATE, text);
  }

  emitResponse(response: AIResponse): void {
    this.win?.webContents.send(IPC_CHANNELS.RESPONSE_UPDATE, response);
  }

  emitCost(cost: CostSummary): void {
    this.win?.webContents.send(IPC_CHANNELS.COST_UPDATE, cost);
  }

  emitAudioLevel(level: number): void {
    this.win?.webContents.send('audio:level', level);
  }
}

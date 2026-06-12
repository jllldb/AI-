import type { ConversationState, AIResponse, CostSummary, ConversationTurn } from '../../shared/types';

export interface ElectronAPI {
  // Media
  startCamera(): Promise<boolean>;
  stopCamera(): Promise<boolean>;
  sendFrame(jpegBase64: string, dhashHex: string): void;
  sendAudioChunk(audioData: number[]): void;

  // Conversation
  sendMessage(text: string, includeFrame: boolean): Promise<AIResponse>;
  toggleAccessibilityMode(enabled: boolean): Promise<boolean>;

  // Events (each returns a cleanup function)
  onStateChange(cb: (s: ConversationState) => void): () => void;
  onTranscript(cb: (t: string) => void): () => void;
  onResponse(cb: (r: AIResponse) => void): () => void;
  onCostUpdate(cb: (c: CostSummary) => void): () => void;
  onAudioLevel(cb: (l: number) => void): () => void;

  // History
  getHistory(query?: string): Promise<ConversationTurn[]>;

  // Preferences
  getPreferences(): Promise<Record<string, string>>;
  setPreferences(prefs: Record<string, string>): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

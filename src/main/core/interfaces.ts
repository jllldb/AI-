import type { ConversationInput, ConversationState, ConversationTurn, ContextWindow, AIResponse, CostSummary, ModelChoice } from '../../shared/types';

// ============ AI Provider ============
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResult {
  text: string;
  tokensUsed: number;
}

export interface VisionOptions {
  imageBase64?: string;
  audioBase64?: string;
  text?: string;
  contextMessages?: ChatMessage[];
}

export interface AIVisionResult extends ChatResult {
  visualDescription?: string;
  emotion?: string;
}

export interface AIProvider {
  readonly name: ModelChoice;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
  chatWithVision(options: VisionOptions): Promise<AIVisionResult>;
  describeImage(imageBase64: string, prompt?: string): Promise<{ description: string; tokensUsed: number }>;
  updateConfig(config: { apiKey?: string; model?: string }): void;
}

// ============ VAD ============
export interface VADCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audioSegments: Float32Array[]) => void;
}

export interface IVADService {
  setCallbacks(cb: VADCallbacks): void;
  processChunk(chunk: Float32Array): { isSilence: boolean; rmsDb: number };
  mergeSegments(segments: Float32Array[]): Float32Array;
  float32ToWav(buffer: Float32Array, sampleRate?: number): Buffer;
}

// ============ Frame Dedup ============
export interface IFrameDedup {
  isDuplicate(hash: bigint, threshold?: number): boolean;
  isSignificantChange(hash: bigint): boolean;
  cacheDescription(desc: string): void;
  getCachedDescription(): string | null;
  reset(): void;
  getConsecutiveCount(): number;
}

// ============ Context Manager ============
export interface IContextManager {
  getContext(): ContextWindow;
  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn;
  buildMessages(context: ContextWindow, currentUserMessage: string): ChatMessage[];
}

// ============ TTS ============
export interface TTSOptions {
  voice?: string;
  rate?: number;
}

export interface ITTSService {
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
  synthesizeToBase64(text: string, options?: TTSOptions): Promise<string>;
}

// ============ Cost Tracker ============
export interface ICostTracker {
  readonly summary: CostSummary;
  recordUsage(tokens: number, model: ModelChoice): void;
  resetDaily(): void;
}

// ============ Model Router ============
export interface IModelRouter {
  route(input: ConversationInput, hasDeepSeekKey: boolean, modelProvider: string): ModelChoice;
  estimateTokens(input: ConversationInput): number;
}

// ============ Conversation Orchestrator ============
export interface IConversationOrchestrator {
  handleFrame(jpegBase64: string, dhashHex: string): void;
  handleTextInput(text: string, includeFrame: boolean): Promise<AIResponse>;
  toggleAccessibility(enabled: boolean): void;
}

// ============ Stores ============
export interface IConversationStore {
  addTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn;
  getRecentTurns(limit?: number): ConversationTurn[];
  searchHistory(query: string, limit?: number): ConversationTurn[];
}

export interface IPreferenceStore {
  init(): void;
  get(key: string): string;
  getAll(): Record<string, string>;
  set(key: string, value: string): void;
}

// ============ IPC Emitter ============
export interface IIpcEmitter {
  setWindow(win: unknown): void;
  emitState(state: ConversationState): void;
  emitTranscript(text: string): void;
  emitResponse(response: AIResponse): void;
  emitCost(cost: CostSummary): void;
  emitAudioLevel(level: number): void;
}

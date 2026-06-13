// ============ 模型供应商 ============
export type ModelChoice = 'qwen' | 'deepseek' | 'openai' | 'gemini' | 'claude' | 'ollama';
export type ModelProvider = ModelChoice | 'auto';

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
  summary?: string;
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
  todayCost: number;
  dailyBudget: number;
  callsSavedByVAD: number;
  callsSavedByDedup: number;
  callsSavedByCache: number;
}

// ============ 用户偏好 ============
export interface UserPreferences {
  qwenApiKey: string;
  deepseekApiKey: string;
  ttsVoice: string;
  ttsRate: number;
  dailyBudget: number;
  accessibilityInterval: number;
}

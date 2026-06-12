import { ConversationInput, ModelChoice } from '../../shared/types';

export class ModelRouter {
  route(input: ConversationInput): ModelChoice {
    if (input.isAccessibilityMode) return 'qwen-omni';
    if (input.hasNewImage) return 'qwen-omni';
    if (input.hasSpeech) {
      if (input.isFollowUp && !input.hasNewImage) return 'deepseek';
      return 'qwen-omni';
    }
    if (input.hasTextInput) return 'deepseek';
    return 'deepseek';
  }

  estimateTokens(input: ConversationInput): number {
    let tokens = 50;
    if (input.hasNewImage) tokens += 90;
    if (input.hasSpeech) tokens += 200;
    if (input.hasTextInput) tokens += 100;
    tokens += 200;
    return tokens;
  }
}

export const modelRouter = new ModelRouter();

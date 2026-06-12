import { ConversationInput, ModelChoice } from '../../shared/types';

export class ModelRouter {
  /**
   * Route to the best model given the input and available API keys.
   * Falls back to Qwen when DeepSeek key is not configured.
   */
  route(input: ConversationInput, hasDeepSeekKey = false): ModelChoice {
    // Always use Qwen for multimodal
    if (input.isAccessibilityMode) return 'qwen-omni';
    if (input.hasNewImage) return 'qwen-omni';
    if (input.hasSpeech) return 'qwen-omni';

    // Text-only: prefer DeepSeek (cheaper) but fall back to Qwen
    if (hasDeepSeekKey) return 'deepseek';
    return 'qwen-omni'; // Fallback: Qwen can handle text too
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

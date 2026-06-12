import { ConversationInput, ModelChoice } from '../../shared/types';
import type { IModelRouter } from '../core/interfaces';

export class ModelRouter implements IModelRouter {
  /**
   * Route to the best model given the input and available API keys.
   * Falls back to Qwen when DeepSeek key is not configured.
   */
  route(input: ConversationInput, hasDeepSeekKey = false, modelProvider = 'qwen'): ModelChoice {
    // Always use Qwen for multimodal (DeepSeek doesn't support images/audio)
    if (input.isAccessibilityMode) return 'qwen';
    if (input.hasNewImage) return 'qwen';
    if (input.hasSpeech) return 'qwen';

    // Text-only: follow user preference
    if (modelProvider === 'deepseek' && hasDeepSeekKey) return 'deepseek';
    if (modelProvider === 'auto' && hasDeepSeekKey) return 'deepseek';
    return 'qwen'; // default/fallback: Qwen handles text too
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

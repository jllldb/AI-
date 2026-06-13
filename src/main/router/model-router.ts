import { ConversationInput, ModelChoice, ModelProvider } from '../../shared/types';

// Priority order for auto-selection (multimodal-capable first)
const AUTO_PRIORITY: ModelChoice[] = ['ollama', 'qwen', 'openai', 'gemini', 'claude', 'deepseek'];

export class ModelRouter {
  route(
    input: ConversationInput,
    availableProviders: Set<ModelChoice>,
    preferredProvider: ModelProvider = 'auto'
  ): ModelChoice {
    // If user picked a specific provider and it's available, use it
    if (preferredProvider !== 'auto' && availableProviders.has(preferredProvider as ModelChoice)) {
      return preferredProvider as ModelChoice;
    }

    // Auto-select: first available provider from priority list
    for (const p of AUTO_PRIORITY) {
      if (availableProviders.has(p)) return p;
    }

    return 'qwen'; // last resort (will likely fail)
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

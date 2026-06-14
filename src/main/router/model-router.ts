import { ConversationInput, ModelChoice, ModelProvider } from '../../shared/types';

// Models that support image/vision input
const VISION_MODELS: Set<ModelChoice> = new Set(['qwen', 'openai', 'gemini', 'claude', 'ollama']);
// Text-only models — cannot process images directly
const TEXT_ONLY: Set<ModelChoice> = new Set(['deepseek']);

// Priority order for auto-selection (multimodal-capable first)
const AUTO_PRIORITY: ModelChoice[] = ['ollama', 'qwen', 'openai', 'gemini', 'claude', 'deepseek'];

export class ModelRouter {
  route(
    input: ConversationInput,
    availableProviders: Set<ModelChoice>,
    preferredProvider: ModelProvider = 'auto'
  ): ModelChoice {
    // If user picked a specific model and it's available
    if (preferredProvider !== 'auto' && availableProviders.has(preferredProvider as ModelChoice)) {
      return preferredProvider as ModelChoice;
    }

    // Auto-select: first available provider from priority list
    for (const p of AUTO_PRIORITY) {
      if (!availableProviders.has(p)) continue;
      // If input has an image, skip text-only models
      if (input.hasNewImage && TEXT_ONLY.has(p)) continue;
      return p;
    }

    // Fallback: if all multimodal models unavailable but image present,
    // use text-only model (image will be described separately)
    for (const p of AUTO_PRIORITY) {
      if (availableProviders.has(p)) return p;
    }

    return 'qwen'; // last resort
  }

  /** Check if a model supports direct image input */
  supportsVision(model: ModelChoice): boolean {
    return VISION_MODELS.has(model);
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

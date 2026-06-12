import type { AIProvider } from '../core/interfaces';
import type { IPreferenceStore } from '../core/interfaces';
import type { ModelChoice } from '../../shared/types';
import { QwenClient } from './qwen-client';
import { DeepSeekClient } from './deepseek-client';
import { OpenAIClient } from './openai-client';
import { GeminiClient } from './gemini-client';
import { ClaudeClient } from './claude-client';

export class AIProviderFactory {
  private providers = new Map<ModelChoice, AIProvider>();

  constructor(private prefs: IPreferenceStore) {}

  initFromPreferences(): void {
    const p = this.prefs.getAll();

    this.register('qwen', new QwenClient(p.qwenApiKey || ''));
    this.register('deepseek', new DeepSeekClient(p.deepseekApiKey || ''));
    this.register('openai', new OpenAIClient(p.openaiApiKey || ''));
    this.register('gemini', new GeminiClient(p.geminiApiKey || ''));
    this.register('claude', new ClaudeClient(p.claudeApiKey || ''));

    // Apply model overrides
    if (p.qwenModel) this.providers.get('qwen')?.updateConfig({ model: p.qwenModel });
    if (p.deepseekModel) this.providers.get('deepseek')?.updateConfig({ model: p.deepseekModel });
    if (p.openaiModel) this.providers.get('openai')?.updateConfig({ model: p.openaiModel });
    if (p.geminiModel) this.providers.get('gemini')?.updateConfig({ model: p.geminiModel });
    if (p.claudeModel) this.providers.get('claude')?.updateConfig({ model: p.claudeModel });
  }

  register(name: ModelChoice, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  get(name: ModelChoice): AIProvider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Provider "${name}" not initialized`);
    return p;
  }

  has(name: ModelChoice): boolean {
    return this.providers.has(name);
  }

  /** Hot-reload provider config without full re-init */
  reloadConfig(name: ModelChoice): void {
    const provider = this.providers.get(name);
    if (!provider) return;
    const p = this.prefs.getAll();
    const keyField = name + 'ApiKey';
    const modelField = name + 'Model';
    const apiKey = p[keyField] || '';
    const model = p[modelField];
    const config: { apiKey?: string; model?: string } = {};
    if (apiKey) config.apiKey = apiKey;
    if (model) config.model = model;
    provider.updateConfig(config);
  }
}

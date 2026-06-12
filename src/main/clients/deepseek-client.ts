import type { AIProvider, ChatMessage, ChatResult, VisionOptions, AIVisionResult } from '../core/interfaces';

export class DeepSeekClient implements AIProvider {
  readonly name = 'deepseek' as const;
  private apiKey: string;
  private model = 'deepseek-chat';
  private baseUrl = 'https://api.deepseek.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  updateConfig(config: { apiKey?: string; model?: string }): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 1024 }),
    });
    if (!response.ok) throw new Error('DeepSeek API error: ' + response.status);
    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  }

  async chatWithVision(options: VisionOptions): Promise<AIVisionResult> {
    // DeepSeek does not support vision — fallback to text-only
    const ctxMsgs = options.contextMessages || [];
    const text = options.text || '';
    const allMsgs: ChatMessage[] = [...ctxMsgs, { role: 'user' as const, content: text }];
    const result = await this.chat(allMsgs);
    return { ...result };
  }

  async describeImage(_imageBase64: string, _prompt?: string): Promise<{ description: string; tokensUsed: number }> {
    throw new Error('DeepSeek does not support image description');
  }
}

export let deepseekClient: DeepSeekClient;
export function initDeepSeekClient(apiKey: string) { deepseekClient = new DeepSeekClient(apiKey); return deepseekClient; }

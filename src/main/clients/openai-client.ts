import type { AIProvider, ChatMessage, ChatResult, VisionOptions, AIVisionResult } from '../core/interfaces';

export class OpenAIClient implements AIProvider {
  readonly name = 'openai' as const;
  private apiKey: string;
  private model = 'gpt-4o';
  private baseUrl = 'https://api.openai.com';

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
    if (!response.ok) throw new Error('OpenAI API error: ' + response.status + ' ' + await response.text());
    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  }

  async chatWithVision(params: VisionOptions): Promise<AIVisionResult> {
    const messages: any[] = [];
    if (params.contextMessages) {
      for (const msg of params.contextMessages) messages.push({ role: msg.role, content: msg.content });
    }
    const contentParts: any[] = [];
    if (params.imageBase64) {
      contentParts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + params.imageBase64, detail: 'low' } });
    }
    if (params.text) contentParts.push({ type: 'text', text: params.text });
    messages.push({ role: 'user', content: contentParts });

    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 1024 }),
    });
    if (!response.ok) throw new Error('OpenAI API error: ' + response.status);
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content ?? '', tokensUsed: data.usage?.total_tokens ?? 0 };
  }

  async describeImage(imageBase64: string, prompt?: string): Promise<{ description: string; tokensUsed: number }> {
    const result = await this.chatWithVision({
      imageBase64,
      text: prompt ?? '请用中文简洁描述画面中有什么，包括物体、人物、场景。一句话概括。',
    });
    return { description: result.text, tokensUsed: result.tokensUsed };
  }
}
export function initOpenAIClient(apiKey: string) { openaiClient = new OpenAIClient(apiKey); return openaiClient; }

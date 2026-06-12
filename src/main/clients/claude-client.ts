import type { AIProvider, ChatMessage, ChatResult, VisionOptions, AIVisionResult } from '../core/interfaces';

export class ClaudeClient implements AIProvider {
  readonly name = 'claude' as const;
  private apiKey: string;
  private model = 'claude-sonnet-4-6';
  private baseUrl = 'https://api.anthropic.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  updateConfig(config: { apiKey?: string; model?: string }): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    // Separate system message
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const body: any = {
      model: this.model,
      max_tokens: 1024,
      messages: chatMessages,
    };
    if (systemMsg) body.system = systemMsg.content;

    const response = await fetch(this.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Claude API error: ' + response.status + ' ' + await response.text());
    const data = await response.json();
    return {
      text: data.content?.[0]?.text ?? '',
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    };
  }

  async chatWithVision(params: VisionOptions): Promise<AIVisionResult> {
    const messages: any[] = [];
    if (params.contextMessages) {
      for (const msg of params.contextMessages) {
        if (msg.role !== 'system') messages.push({ role: msg.role, content: msg.content });
      }
    }
    const contentParts: any[] = [];
    if (params.imageBase64) {
      contentParts.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: params.imageBase64 },
      });
    }
    if (params.text) contentParts.push({ type: 'text', text: params.text });
    messages.push({ role: 'user', content: contentParts });

    const response = await fetch(this.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, messages }),
    });
    if (!response.ok) throw new Error('Claude API error: ' + response.status);
    const data = await response.json();
    return {
      text: data.content?.[0]?.text ?? '',
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    };
  }

  async describeImage(imageBase64: string, prompt?: string): Promise<{ description: string; tokensUsed: number }> {
    const result = await this.chatWithVision({
      imageBase64,
      text: prompt ?? '请用中文简洁描述画面中有什么，包括物体、人物、场景。一句话概括。',
    });
    return { description: result.text, tokensUsed: result.tokensUsed };
  }
}

export let claudeClient: ClaudeClient;
export function initClaudeClient(apiKey: string) { claudeClient = new ClaudeClient(apiKey); return claudeClient; }

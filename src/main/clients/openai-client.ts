export class OpenAIClient {
  private apiKey: string;
  private model = 'gpt-4o';
  private baseUrl = 'https://api.openai.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async verifyApiKey(): Promise<{ valid: boolean; message: string }> {
    try {
      const response = await fetch(this.baseUrl + '/v1/models', {
        headers: { 'Authorization': 'Bearer ' + this.apiKey },
      });
      if (response.ok) return { valid: true, message: '✅ OpenAI API Key 有效' };
      if (response.status === 401) return { valid: false, message: '❌ Key 无效或无权限 (HTTP 401)' };
      if (response.status === 429) return { valid: false, message: '⚠️ 请求过于频繁，请稍后再试' };
      const body = await response.text().catch(() => '');
      return { valid: false, message: '⚠️ API 返回: HTTP ' + response.status + (body ? ' — ' + body.slice(0, 120) : '') };
    } catch (e: any) {
      return { valid: false, message: '❌ 网络请求失败: ' + (e.message || String(e)) };
    }
  }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
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

  async chatWithVision(params: {
    imageBase64?: string;
    text?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<{ text: string; tokensUsed: number }> {
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
}

export let openaiClient: OpenAIClient;
export function initOpenAIClient(apiKey: string) { openaiClient = new OpenAIClient(apiKey); return openaiClient; }

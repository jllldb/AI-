export class ClaudeClient {
  private apiKey: string;
  private model = 'claude-sonnet-4-6';
  private baseUrl = 'https://api.anthropic.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async verifyApiKey(): Promise<{ valid: boolean; message: string }> {
    try {
      // Use a minimal messages list call to verify the key
      const response = await fetch(this.baseUrl + '/v1/messages?limit=1', {
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      });
      // Anthropic returns 200 with empty list on valid key; 401 on invalid
      if (response.ok) return { valid: true, message: '✅ Claude API Key 有效' };
      if (response.status === 401 || response.status === 403) return { valid: false, message: '❌ Key 无效 (HTTP ' + response.status + ')' };
      const body = await response.text().catch(() => '');
      return { valid: false, message: '⚠️ API 返回: HTTP ' + response.status + (body ? ' — ' + body.slice(0, 120) : '') };
    } catch (e: any) {
      return { valid: false, message: '❌ 网络请求失败: ' + (e.message || String(e)) };
    }
  }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
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

  async chatWithVision(params: {
    imageBase64?: string;
    text?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<{ text: string; tokensUsed: number }> {
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
}

export let claudeClient: ClaudeClient;
export function initClaudeClient(apiKey: string) { claudeClient = new ClaudeClient(apiKey); return claudeClient; }

export class DeepSeekClient {
  private apiKey: string;
  private model = 'deepseek-chat';
  private baseUrl = 'https://api.deepseek.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async verifyApiKey(): Promise<{ valid: boolean; message: string }> {
    try {
      // DeepSeek doesn't have a /models endpoint; use a minimal user balance check
      const response = await fetch(this.baseUrl + '/user/balance', {
        headers: { 'Authorization': 'Bearer ' + this.apiKey },
      });
      if (response.ok) {
        const data = await response.json();
        const info = data?.balance_infos ? ' (余额可用)' : '';
        return { valid: true, message: '✅ DeepSeek API Key 有效' + info };
      }
      if (response.status === 401) return { valid: false, message: '❌ Key 无效 (HTTP 401)' };
      return { valid: false, message: '⚠️ API 返回: HTTP ' + response.status };
    } catch (e: any) {
      return { valid: false, message: '❌ 网络请求失败: ' + (e.message || String(e)) };
    }
  }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!response.ok) throw new Error('DeepSeek API error: ' + response.status);
    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  }
}

export let deepseekClient: DeepSeekClient;
export function initDeepSeekClient(apiKey: string) { deepseekClient = new DeepSeekClient(apiKey); return deepseekClient; }

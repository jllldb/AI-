export class DeepSeekClient {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 1024 }),
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

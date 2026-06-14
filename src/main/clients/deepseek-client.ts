export class DeepSeekClient {
  private apiKey: string;
  private model = 'deepseek-chat';
  private baseUrl = 'https://api.deepseek.com';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 200, temperature: 0.9 }),
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

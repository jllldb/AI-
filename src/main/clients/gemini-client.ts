export class GeminiClient {
  private apiKey: string;
  private model = 'gemini-2.5-flash';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    // Convert to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const sysMsg = messages.find(m => m.role === 'system');

    const body: any = { contents };
    if (sysMsg) body.systemInstruction = { parts: [{ text: sysMsg.content }] };

    const response = await fetch(
      this.baseUrl + '/models/' + this.model + ':generateContent?key=' + this.apiKey,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!response.ok) throw new Error('Gemini API error: ' + response.status + ' ' + await response.text());
    const data = await response.json();
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
    };
  }

  async chatWithVision(params: {
    imageBase64?: string;
    text?: string;
  }): Promise<{ text: string; tokensUsed: number }> {
    const parts: any[] = [];
    if (params.text) parts.push({ text: params.text });
    if (params.imageBase64) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: params.imageBase64 } });
    }

    const response = await fetch(
      this.baseUrl + '/models/' + this.model + ':generateContent?key=' + this.apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
      }
    );
    if (!response.ok) throw new Error('Gemini API error: ' + response.status);
    const data = await response.json();
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
    };
  }
}

export let geminiClient: GeminiClient;
export function initGeminiClient(apiKey: string) { geminiClient = new GeminiClient(apiKey); return geminiClient; }

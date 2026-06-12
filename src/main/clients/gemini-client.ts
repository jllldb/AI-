import type { AIProvider, ChatMessage, ChatResult, VisionOptions, AIVisionResult } from '../core/interfaces';

export class GeminiClient implements AIProvider {
  readonly name = 'gemini' as const;
  private apiKey: string;
  private model = 'gemini-2.5-flash';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  updateConfig(config: { apiKey?: string; model?: string }): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
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

  async chatWithVision(params: VisionOptions): Promise<AIVisionResult> {
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

  async describeImage(imageBase64: string, prompt?: string): Promise<{ description: string; tokensUsed: number }> {
    const result = await this.chatWithVision({
      imageBase64,
      text: prompt ?? '请用中文简洁描述画面中有什么，包括物体、人物、场景。一句话概括。',
    });
    return { description: result.text, tokensUsed: result.tokensUsed };
  }
}

export let geminiClient: GeminiClient;
export function initGeminiClient(apiKey: string) { geminiClient = new GeminiClient(apiKey); return geminiClient; }

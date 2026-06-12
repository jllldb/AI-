import { QwenResponse } from '../../shared/types';
import type { AIProvider, ChatMessage, ChatResult, VisionOptions, AIVisionResult } from '../core/interfaces';

export class QwenClient implements AIProvider {
  readonly name = 'qwen' as const;
  private apiKey: string;
  private model = 'qwen-vl-plus';
  private baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  updateConfig(config: { apiKey?: string; model?: string }): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const text = messages.map(m => m.content).join('\n');
    return this.chatWithVision({ text, contextMessages: messages });
  }

  async chatWithVision(params: VisionOptions): Promise<AIVisionResult> {
    const result = await this.multimodalChat(params);
    return {
      text: result.responseText,
      visualDescription: result.visualDescription,
      tokensUsed: result.tokensUsed,
    };
  }

  async multimodalChat(params: {
    imageBase64?: string;
    audioBase64?: string;
    text?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<QwenResponse & { tokensUsed: number }> {
    const messages: any[] = [];
    if (params.contextMessages) {
      for (const msg of params.contextMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    const contentParts: any[] = [];
    if (params.imageBase64) {
      contentParts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + params.imageBase64 } });
    }
    if (params.audioBase64) {
      contentParts.push({ type: 'input_audio', input_audio: { data: params.audioBase64, format: 'wav' } });
    }
    if (params.text) {
      contentParts.push({ type: 'text', text: params.text });
    }
    messages.push({ role: 'user', content: contentParts.length > 1 ? contentParts : contentParts[0] });

    const response = await fetch(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 1024 }),
    });
    if (!response.ok) throw new Error('Qwen API error: ' + response.status + ' ' + await response.text());
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;
    return { transcription: '', visualDescription: '', responseText: content, tokensUsed };
  }

  async describeImage(imageBase64: string, prompt?: string): Promise<{ description: string; tokensUsed: number }> {
    const defaultPrompt = '请用中文简洁描述画面中有什么，包括物体、人物、场景。一句话概括。';
    const response = await fetch(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } },
            { type: 'text', text: prompt ?? defaultPrompt },
          ],
        }],
        max_tokens: 256,
      }),
    });
    if (!response.ok) throw new Error('Qwen vision error: ' + response.status);
    const data = await response.json();
    return {
      description: data.choices?.[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  }
}

export let qwenClient: QwenClient;
export function initQwenClient(apiKey: string) { qwenClient = new QwenClient(apiKey); return qwenClient; }

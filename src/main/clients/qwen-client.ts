import { QwenResponse } from '../../shared/types';

export class QwenClient {
  private apiKey: string;
  private model = 'qwen-vl-plus';
  private baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(apiKey: string) { this.apiKey = apiKey; }
  setApiKey(key: string) { this.apiKey = key; }
  setModel(model: string) { this.model = model; }

  async multimodalChat(params: {
    imageBase64?: string;
    audioBase64?: string;
    text?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<QwenResponse & { tokensUsed: number }> {
    const messages: any[] = [];
    if (params.contextMessages) {
      for (const msg of params.contextMessages) {
        // Ensure content is always a plain string (Qwen API rejects objects in text-only context)
        const content = typeof msg.content === 'string' ? msg.content : String(msg.content || '');
        messages.push({ role: msg.role, content });
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
    // Text-only: content must be a plain string. Multimodal: content is array.
    const userContent = contentParts.length === 1 && contentParts[0].type === 'text'
      ? params.text!
      : contentParts;
    messages.push({ role: 'user', content: userContent });

    const body = JSON.stringify({ model: this.model, messages, max_tokens: 1024, temperature: 0.9 });
    console.log('[Qwen] Sending', messages.length, 'msgs, body size:', body.length);
    const response = await fetch(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) throw new Error('Qwen API error: ' + response.status + ' ' + await response.text());
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;
    return { transcription: '', visualDescription: '', responseText: content, tokensUsed };
  }

  /** Verify API key by making a minimal models list call (1 token, near-zero cost) */
  async verifyApiKey(): Promise<{ valid: boolean; message: string }> {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/models', {
        headers: { 'Authorization': 'Bearer ' + this.apiKey },
      });
      if (response.ok) {
        return { valid: true, message: '✅ 千问 API Key 有效' };
      }
      const body = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: '❌ Key 无效或无权访问 (HTTP ' + response.status + ')' };
      }
      if (response.status === 429) {
        return { valid: false, message: '⚠️ 请求过于频繁，请稍后再试' };
      }
      return { valid: false, message: '⚠️ API 返回异常: HTTP ' + response.status + (body ? ' — ' + body.slice(0, 120) : '') };
    } catch (e: any) {
      return { valid: false, message: '❌ 网络请求失败: ' + (e.message || String(e)) };
    }
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
        max_tokens: 256, temperature: 0.9
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

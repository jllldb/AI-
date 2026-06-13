/**
 * Ollama local model client — zero API cost, runs entirely on your machine.
 * Requires Ollama installed: https://ollama.com
 * Recommended models: qwen3, llama3.2-vision, gemma3
 */
export class OllamaClient {
  private model = 'qwen3';
  private baseUrl = 'http://localhost:11434';

  setModel(model: string) { this.model = model; }
  setApiKey(_key: string) { /* Ollama is local, no API key needed */ }

  async chat(messages: { role: string; content: string }[]): Promise<{ text: string; tokensUsed: number }> {
    const response = await fetch(this.baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!response.ok) throw new Error('Ollama error: ' + response.status + ' — is Ollama running?');
    const data = await response.json();
    return {
      text: data.message?.content ?? '',
      tokensUsed: data.eval_count ?? 0,
    };
  }

  async chatWithVision(params: {
    imageBase64?: string;
    text?: string;
  }): Promise<{ text: string; tokensUsed: number }> {
    const messages: any[] = [];
    const contentParts: any[] = [];
    if (params.text) contentParts.push({ type: 'text', text: params.text });
    if (params.imageBase64) {
      contentParts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + params.imageBase64 } });
    }
    messages.push({ role: 'user', content: contentParts });

    const response = await fetch(this.baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!response.ok) throw new Error('Ollama vision error: ' + response.status);
    const data = await response.json();
    return { text: data.message?.content ?? '', tokensUsed: data.eval_count ?? 0 };
  }

  /** Check if Ollama is running locally */
  async isAvailable(): Promise<boolean> {
    try {
      const r = await fetch(this.baseUrl + '/api/tags', { signal: AbortSignal.timeout(2000) });
      return r.ok;
    } catch { return false; }
  }
}

export let ollamaClient: OllamaClient;
export function initOllamaClient() { ollamaClient = new OllamaClient(); return ollamaClient; }

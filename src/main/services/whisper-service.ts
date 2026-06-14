export type WhisperStatus = 'unloaded' | 'loading' | 'ready' | 'error';

let transcriber: any = null;
let loadPromise: Promise<void> | null = null;
let status: WhisperStatus = 'unloaded';
let statusMessage = '';

/**
 * Local Whisper speech-to-text using @xenova/transformers.
 * Uses hf-mirror.com for China accessibility.
 * First run downloads ~40MB model, subsequent runs are instant.
 * Runs entirely locally — no API keys, no network after download.
 */
export class WhisperService {
  getStatus(): { status: WhisperStatus; message: string } {
    return { status, message: statusMessage };
  }

  preload(): void {
    if (status === 'ready' || status === 'loading') return;
    this.ensureLoaded().catch(() => {});
  }

  private async ensureLoaded(): Promise<void> {
    if (transcriber) {
      status = 'ready';
      return;
    }

    if (loadPromise) {
      await loadPromise;
      if (transcriber) return;
    }

    status = 'loading';
    statusMessage = '正在下载语音模型 (~40MB)...';
    console.log('[Whisper] Loading whisper-tiny model...');
    loadPromise = (async () => {
      try {
        // Use new Function for true dynamic import (ESM can't be require()'d)
        const imp = new Function('m', 'return import(m)') as (path: string) => Promise<any>;
        const mod = await imp('@xenova/transformers');

        // Use HF mirror for China accessibility
        mod.env.remoteHost = 'https://hf-mirror.com';
        console.log('[Whisper] Using HF mirror: https://hf-mirror.com');

        transcriber = await mod.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          quantized: true,
        });
        status = 'ready';
        statusMessage = '语音模型就绪';
        console.log('[Whisper] Model loaded successfully');
      } catch (err: any) {
        status = 'error';
        statusMessage = '语音模型加载失败: ' + (err.message || String(err));
        console.error('[Whisper] Failed to load model:', err.message);
        loadPromise = null; // Allow retry on next call
        throw err;
      }
    })();
    await loadPromise;
  }

  async transcribeFromWav(wavBuffer: Buffer): Promise<string> {
    await this.ensureLoaded();
    if (!transcriber) throw new Error('Whisper model not loaded: ' + statusMessage);

    const samples = new Float32Array((wavBuffer.length - 44) / 2);
    for (let i = 44, j = 0; i < wavBuffer.length - 1; i += 2, j++) {
      samples[j] = wavBuffer.readInt16LE(i) / 32768;
    }

    const result = await transcriber(samples, {
      language: 'zh',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return result?.text || '';
  }

  isLoaded(): boolean { return status === 'ready'; }
}

export const whisperService = new WhisperService();

import { ipcMain } from 'electron';

let transcriber: any = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Local Whisper speech-to-text using @xenova/transformers.
 * First run downloads ~40MB model, subsequent runs are instant.
 * Runs entirely locally — no API keys, no network after download.
 */
export class WhisperService {
  private async ensureLoaded(): Promise<void> {
    if (transcriber) return;

    if (loadPromise) {
      await loadPromise;
      if (transcriber) return;
    }

    loading = true;
    loadPromise = (async () => {
      try {
        console.log('[Whisper] Loading whisper-tiny model (first time downloads ~40MB)...');
        const { pipeline } = await import('@xenova/transformers');
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          quantized: true,
        });
        console.log('[Whisper] Model loaded successfully');
      } catch (err: any) {
        console.error('[Whisper] Failed to load model:', err.message);
        throw err;
      } finally {
        loading = false;
        loadPromise = null;
      }
    })();
    await loadPromise;
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    await this.ensureLoaded();
    if (!transcriber) throw new Error('Whisper model not loaded');

    // Convert ArrayBuffer to Float32Array
    const floatData = new Float32Array(audioBuffer);

    // Run transcription
    const result = await transcriber(floatData, {
      language: 'zh',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return result?.text || '';
  }

  async transcribeFromWav(wavBuffer: Buffer): Promise<string> {
    await this.ensureLoaded();
    if (!transcriber) throw new Error('Whisper model not loaded');

    // Convert WAV buffer to Float32Array
    // Skip 44-byte WAV header, read 16-bit PCM samples
    const samples = new Float32Array((wavBuffer.length - 44) / 2);
    for (let i = 44, j = 0; i < wavBuffer.length - 1; i += 2, j++) {
      const sample = wavBuffer.readInt16LE(i);
      samples[j] = sample / 32768;
    }

    const result = await transcriber(samples, {
      language: 'zh',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return result?.text || '';
  }

  isLoaded(): boolean { return !!transcriber; }
  isLoading(): boolean { return loading; }
}

export const whisperService = new WhisperService();

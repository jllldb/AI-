/**
 * Local Whisper via @xenova/transformers — bundled by Vite for the renderer.
 * First run downloads ~40MB model from HuggingFace CDN (uncached in China — needs VPN).
 */
let transcriber: any = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

export async function ensureWhisper(): Promise<boolean> {
  if (transcriber) return true;
  if (loading && loadPromise) {
    await loadPromise;
    return !!transcriber;
  }
  loading = true;
  loadPromise = (async () => {
    try {
      console.log('[Whisper] Loading via Vite ESM...');
      const { pipeline } = await import('@xenova/transformers');
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', { quantized: true });
      console.log('[Whisper] Model loaded OK');
    } catch (e: any) {
      console.error('[Whisper] Load failed:', e.message);
    } finally {
      loading = false;
      loadPromise = null;
    }
  })();
  await loadPromise;
  return !!transcriber;
}

export async function transcribeWithWhisper(audioFloat32: Float32Array): Promise<string> {
  const ok = await ensureWhisper();
  if (!ok) return '';
  try {
    const result = await transcriber(audioFloat32, {
      language: 'zh',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return result?.text?.trim() || '';
  } catch {
    return '';
  }
}

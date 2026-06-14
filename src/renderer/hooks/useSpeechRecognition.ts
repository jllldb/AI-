import { useState, useRef, useCallback } from 'react';

/**
 * PTT (Push-to-Talk) speech recognition hook.
 * Records raw PCM audio, converts to WAV, sends to main process whisperService for transcription.
 * Optionally reuses an existing MediaStream to avoid dual-getUserMedia conflicts.
 */
export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const chunksRef = useRef<Float32Array[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const start = useCallback(async (existingStream?: MediaStream | null): Promise<void> => {
    setInterimText('');
    chunksRef.current = [];

    try {
      let stream: MediaStream;
      if (existingStream?.getAudioTracks().length) {
        stream = existingStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor for raw PCM capture (4096 samples per chunk at 16kHz = ~256ms)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const channelData = e.inputBuffer.getChannelData(0);
        // Copy the Float32Array (it's reused after this callback)
        chunksRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
      setInterimText('🔴 录音中...');
      console.log('[PTT] Recording started, stream:', stream.getAudioTracks()[0]?.label);
    } catch (err: any) {
      console.error('[PTT] Start failed:', err.message);
      setInterimText('❌ 麦克风不可用: ' + (err.message || '未知错误'));
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback(async (): Promise<string> => {
    setIsRecording(false);
    setInterimText('⏳ 识别中...');

    return new Promise((resolve) => {
      // Clean up audio graph
      try {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch { /* ignore cleanup errors */ }
      processorRef.current = null;
      sourceRef.current = null;
      audioCtxRef.current = null;

      const chunkCount = chunksRef.current.length;
      if (chunkCount === 0) {
        console.log('[PTT] No audio recorded');
        setInterimText('⚠️ 未检测到语音');
        resolve('');
        return;
      }

      // Merge all chunks into one Float32Array
      const totalLen = chunksRef.current.reduce((s, c) => s + c.length, 0);
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of chunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      chunksRef.current = [];

      const durationSec = (totalLen / 16000).toFixed(1);
      console.log(`[PTT] Recorded ${chunkCount} chunks, ${durationSec}s, ${totalLen} samples`);

      if (totalLen < 8000) {
        // Less than 0.5 seconds of audio — too short
        setInterimText('⚠️ 录音太短，请按住说话');
        resolve('');
        return;
      }

      // Convert to WAV base64
      const wavBase64 = float32ToWavBase64(merged, 16000);

      // Send to main process for transcription
      const api = (window as any).electronAPI;
      if (api?.transcribeAudio) {
        api.transcribeAudio(wavBase64)
          .then((result: any) => {
            if (result?.text?.trim()) {
              console.log('[PTT] Transcribed:', result.text);
              setInterimText('');
              resolve(result.text.trim());
            } else if (result?.error) {
              console.error('[PTT] Main process transcription error:', result.error);
              setInterimText('⚠️ 识别失败');
              resolve('');
            } else {
              console.log('[PTT] Empty transcription result');
              setInterimText('⚠️ 未识别到内容');
              resolve('');
            }
          })
          .catch((err: any) => {
            console.error('[PTT] IPC transcription failed:', err);
            setInterimText('⚠️ 连接异常');
            resolve('');
          });
      } else {
        console.log('[PTT] electronAPI not available — cannot transcribe');
        setInterimText('⚠️ 服务未就绪');
        resolve('');
      }
    });
  }, []);

  return { start, stop, isRecording, interimText };
}

/** Convert Float32Array PCM to WAV base64 string (client-side, no Buffer) */
function float32ToWavBase64(buffer: Float32Array, sampleRate: number): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const wav = new ArrayBuffer(totalSize);
  const v = new DataView(wav);
  let p = 0;

  const w = (s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)); };
  w('RIFF');
  v.setUint32(p, totalSize - 8, true); p += 4;
  w('WAVE');
  w('fmt ');
  v.setUint32(p, 16, true); p += 4;
  v.setUint16(p, 1, true); p += 2; // PCM = 1
  v.setUint16(p, numChannels, true); p += 2;
  v.setUint32(p, sampleRate, true); p += 4;
  v.setUint32(p, byteRate, true); p += 4;
  v.setUint16(p, blockAlign, true); p += 2;
  v.setUint16(p, bitsPerSample, true); p += 2;
  w('data');
  v.setUint32(p, dataSize, true); p += 4;

  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    v.setInt16(p, int16, true); p += 2;
  }

  // ArrayBuffer → base64
  const bytes = new Uint8Array(wav);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

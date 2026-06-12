import type { IVADService, VADCallbacks } from '../core/interfaces';

export type { VADCallbacks };

export class VADService implements IVADService {
  private callbacks: VADCallbacks | null = null;
  private isSpeaking = false;
  private silenceStartTime = 0;
  private speechSegments: Float32Array[] = [];
  private speechStartedAt = 0;

  setCallbacks(cb: VADCallbacks) { this.callbacks = cb; }

  processChunk(chunk: Float32Array): { isSilence: boolean; rmsDb: number } {
    const rmsDb = this.calculateRMSDb(chunk);
    const isSilence = rmsDb < -40; // -40 dBFS
    const now = Date.now();

    if (!this.isSpeaking && !isSilence) {
      this.isSpeaking = true;
      this.speechSegments = [chunk];
      this.speechStartedAt = now;
      this.callbacks?.onSpeechStart();
    } else if (this.isSpeaking && !isSilence) {
      this.speechSegments.push(chunk);
      this.silenceStartTime = 0;
    } else if (this.isSpeaking && isSilence) {
      if (this.silenceStartTime === 0) this.silenceStartTime = now;
      this.speechSegments.push(chunk);
      const silenceDuration = now - this.silenceStartTime;
      const speechDuration = now - this.speechStartedAt;
      if (silenceDuration >= 1500 && speechDuration >= 300) {
        this.isSpeaking = false;
        this.silenceStartTime = 0;
        const segs = [...this.speechSegments];
        this.speechSegments = [];
        this.callbacks?.onSpeechEnd(segs);
      }
    }
    return { isSilence, rmsDb };
  }

  private calculateRMSDb(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    if (rms < 1e-10) return -100;
    return 20 * Math.log10(rms);
  }

  mergeSegments(segments: Float32Array[]): Float32Array {
    const total = segments.reduce((s, seg) => s + seg.length, 0);
    const result = new Float32Array(total);
    let offset = 0;
    for (const seg of segments) { result.set(seg, offset); offset += seg.length; }
    return result;
  }

  float32ToWav(buffer: Float32Array, sampleRate = 16000): Buffer {
    const numChannels = 1, bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = buffer.length * blockAlign;
    const totalSize = 44 + dataSize;
    const wav = Buffer.alloc(totalSize);
    let o = 0;
    wav.write('RIFF', o); o += 4;
    wav.writeUInt32LE(totalSize - 8, o); o += 4;
    wav.write('WAVE', o); o += 4;
    wav.write('fmt ', o); o += 4;
    wav.writeUInt32LE(16, o); o += 4;
    wav.writeUInt16LE(1, o); o += 2;
    wav.writeUInt16LE(numChannels, o); o += 2;
    wav.writeUInt32LE(sampleRate, o); o += 4;
    wav.writeUInt32LE(byteRate, o); o += 4;
    wav.writeUInt16LE(blockAlign, o); o += 2;
    wav.writeUInt16LE(bitsPerSample, o); o += 2;
    wav.write('data', o); o += 4;
    wav.writeUInt32LE(dataSize, o); o += 4;
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      wav.writeInt16LE(s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), o);
      o += 2;
    }
    return wav;
  }
}

export const vadService = new VADService();

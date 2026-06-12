import { EdgeTTS } from 'node-edge-tts';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

import type { ITTSService, TTSOptions } from '../core/interfaces';

export type { TTSOptions };

export class TTSService implements ITTSService {
  async synthesize(text: string, options: TTSOptions = {}): Promise<Buffer> {
    const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
    const rate = options.rate || 1.0;
    const rateStr = '+' + Math.round((rate - 1) * 100) + '%';

    const tts = new EdgeTTS({ voice, rate: rateStr });
    const tmpPath = join(tmpdir(), 'tts-' + randomUUID() + '.mp3');
    try {
      await tts.ttsPromise(text, tmpPath);
      const buf = await readFile(tmpPath);
      await unlink(tmpPath).catch(() => {});
      return buf;
    } catch {
      await unlink(tmpPath).catch(() => {});
      throw new Error('TTS synthesis failed');
    }
  }

  async synthesizeToBase64(text: string, options?: TTSOptions): Promise<string> {
    const buf = await this.synthesize(text, options);
    return buf.toString('base64');
  }

  static readonly VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声, 活泼)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
    { id: 'zh-CN-YunjianNeural', name: '云健 (男声)' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声)' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男声)' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女声)' },
  ];
}

export const ttsService = new TTSService();

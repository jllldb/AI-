import { useState, useRef, useCallback } from 'react';
import { transcribeWithWhisper, ensureWhisper } from './useWhisper';

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async (): Promise<string> => {
    setInterimText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstart = () => { setIsRecording(true); setInterimText('🔴 录音中...'); };
      recorder.start(100);
    } catch (err: any) {
      setInterimText('❌ 麦克风不可用');
      setIsRecording(false);
    }
    return '';
  }, []);

  const stop = useCallback(async (): Promise<string> => {
    setIsRecording(false);
    setInterimText('⏳ 识别中...');

    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) { resolve(''); return; }
      const recorder = mediaRecorderRef.current;

      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) { setInterimText('⚠️ 录音太短'); resolve(''); return; }

        // Try local Whisper first
        const ctx = new AudioContext({ sampleRate: 16000 });
        try {
          const ab = await blob.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(ab);
          const text = await transcribeWithWhisper(audioBuf.getChannelData(0));
          if (text) { setInterimText(''); resolve(text); return; }
        } catch (e: any) { console.log('[Whisper] failed:', e.message); }
        ctx.close();

        // Fallback: Web Speech API
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SR) {
          const rec = new SR();
          rec.lang = 'zh-CN'; rec.interimResults = false;
          rec.onresult = (e: any) => resolve(e.results[0]?.[0]?.transcript?.trim() || '🎤 语音消息');
          rec.onerror = () => resolve('🎤 语音消息');
          rec.start();
          setTimeout(() => { rec.stop(); resolve('🎤 语音消息'); }, 8000);
        } else {
          resolve('🎤 语音消息');
        }
      };
      recorder.stop();
    });
  }, []);

  return { start, stop, isRecording, interimText };
}

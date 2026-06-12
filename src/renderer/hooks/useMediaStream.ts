import { useEffect, useRef, useState, useCallback } from 'react';

export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;

      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      const ctx = canvasRef.current.getContext('2d')!;

      frameIntervalRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const jpeg = canvasRef.current.toDataURL('image/jpeg', 0.75).split(',')[1];
          const dhash = computeDhash(ctx, 640, 480);
          (window as any).electronAPI?.sendFrame(jpeg, dhash);
        }
      }, 500);

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(ms);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current.onaudioprocess = (e) => {
        const data = Array.from(e.inputBuffer.getChannelData(0));
        (window as any).electronAPI?.sendAudioChunk(data);
      };
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) { console.error('Media start error:', err); }
  }, []);

  const stopCapture = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  return { stream, startCapture, stopCapture, videoRef };
}

function computeDhash(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const tc = document.createElement('canvas'); tc.width = 17; tc.height = 17;
  const tctx = tc.getContext('2d')!;
  tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, 17, 17);
  const pixels = tctx.getImageData(0, 0, 17, 17).data;
  const gray: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) gray.push(0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2]);
  let hash = 0n;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (gray[y * 17 + x] > gray[y * 17 + x + 1]) hash |= (1n << BigInt(255 - (y * 16 + x)));
  return hash.toString(16).padStart(64, '0');
}

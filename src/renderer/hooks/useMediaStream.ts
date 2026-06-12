import { useRef, useState, useCallback } from 'react';

export interface MediaError {
  type: 'camera' | 'microphone' | 'both' | 'unknown';
  message: string;
}

export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<MediaError | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameCountRef = useRef(0);
  const audioChunkCountRef = useRef(0);

  const startCapture = useCallback(async () => {
    setMediaError(null);
    console.log('[Media] Requesting camera + microphone...');

    // Check API availability
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError({ type: 'both', message: '浏览器不支持摄像头/麦克风访问 (mediaDevices API 不可用)' });
      return;
    }

    try {
      // Try to enumerate devices first to check availability
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      console.log('[Media] Devices found — video:', hasVideo, 'audio:', hasAudio);

      if (!hasVideo && !hasAudio) {
        setMediaError({ type: 'both', message: '未检测到摄像头或麦克风设备' });
        return;
      }

      // Request media with relaxed constraints first
      const ms = await navigator.mediaDevices.getUserMedia({
        video: hasVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: hasAudio ? { sampleRate: { ideal: 16000 } } : false,
      });
      console.log('[Media] getUserMedia SUCCESS — tracks:', ms.getTracks().map(t => t.kind).join(', '));
      setStream(ms);
      setIsCapturing(true);

      // Bind to video element
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.onloadedmetadata = () => {
          console.log('[Media] Video metadata loaded, playing...');
          videoRef.current?.play().catch(e => console.warn('[Media] Autoplay failed:', e));
        };
      }

      // Setup canvas for frame capture
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      const ctx = canvasRef.current.getContext('2d')!;
      frameCountRef.current = 0;

      frameIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        try {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const jpeg = canvasRef.current.toDataURL('image/jpeg', 0.75).split(',')[1];
          const dhash = computeDhash(ctx, 640, 480);
          (window as any).electronAPI?.sendFrame(jpeg, dhash);
          frameCountRef.current++;
          if (frameCountRef.current % 20 === 1) {
            console.log('[Media] Frames sent:', frameCountRef.current, 'hash:', dhash.substring(0, 16) + '...');
          }
        } catch (e) {
          console.error('[Media] Frame capture error:', e);
        }
      }, 500);

      // Setup audio processing
      try {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(ms);
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        audioChunkCountRef.current = 0;

        processorRef.current.onaudioprocess = (e) => {
          const data = Array.from(e.inputBuffer.getChannelData(0));
          (window as any).electronAPI?.sendAudioChunk(data);
          audioChunkCountRef.current++;
          if (audioChunkCountRef.current % 50 === 1) {
            console.log('[Media] Audio chunks sent:', audioChunkCountRef.current);
          }
        };
        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
        console.log('[Media] Audio processing pipeline started');
      } catch (e) {
        console.error('[Media] Audio setup error:', e);
        setMediaError({ type: 'microphone', message: '麦克风初始化失败: ' + String(e) });
      }

    } catch (err: any) {
      console.error('[Media] getUserMedia FAILED:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        setMediaError({ type: 'both', message: '摄像头/麦克风权限被拒绝。请在系统设置中允许访问。' });
      } else if (err.name === 'NotFoundError') {
        setMediaError({ type: 'both', message: '未找到摄像头或麦克风设备。' });
      } else if (err.name === 'NotReadableError') {
        setMediaError({ type: 'both', message: '摄像头/麦克风被其他应用占用中。' });
      } else {
        setMediaError({ type: 'unknown', message: err.name + ': ' + (err.message || '未知错误') });
      }
    }
  }, []);

  const stopCapture = useCallback(() => {
    console.log('[Media] Stopping capture...');
    if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsCapturing(false);
    setMediaError(null);
  }, [stream]);

  return { stream, startCapture, stopCapture, videoRef, mediaError, isCapturing };
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

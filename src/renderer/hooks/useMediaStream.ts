import { useRef, useState, useCallback } from 'react';
import { getApi } from '../lib/electron-api';
import { computeDhash } from '../lib/dhash';

export interface MediaDiag {
  apiAvailable: boolean;
  devicesChecked: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  gUMStatus: '' | 'pending' | 'success' | 'failed';
  gUMError: string;
  framesCaptured: number;
  audioChunksSent: number;
  audioTrackState: string;
}

export interface MediaError {
  type: 'camera' | 'microphone' | 'both' | 'unknown';
  message: string;
}

export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<MediaError | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [diag, setDiag] = useState<MediaDiag>({
    apiAvailable: false, devicesChecked: false, hasVideo: false, hasAudio: false,
    gUMStatus: '', gUMError: '', framesCaptured: 0, audioChunksSent: 0, audioTrackState: '',
  });

  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameCountRef = useRef(0);
  const audioChunkCountRef = useRef(0);

  const startCapture = useCallback(async () => {
    setMediaError(null);
    setDiag(d => ({ ...d, apiAvailable: !!navigator.mediaDevices?.getUserMedia }));

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError({ type: 'both', message: 'mediaDevices API 不可用' });
      setDiag(d => ({ ...d, gUMStatus: 'failed', gUMError: 'API unavailable' }));
      return;
    }

    try {
      setDiag(d => ({ ...d, gUMStatus: 'pending' }));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      setDiag(d => ({ ...d, devicesChecked: true, hasVideo, hasAudio }));

      if (!hasVideo && !hasAudio) {
        setMediaError({ type: 'both', message: '未检测到摄像头或麦克风' });
        setDiag(d => ({ ...d, gUMStatus: 'failed', gUMError: 'No devices' }));
        return;
      }

      const ms = await navigator.mediaDevices.getUserMedia({
        video: hasVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: hasAudio ? true : false,
      });
      setStream(ms);
      setIsCapturing(true);
      const audioTrack = ms.getAudioTracks()[0];
      setDiag(d => ({ ...d, gUMStatus: 'success', audioTrackState: audioTrack?.readyState || 'none' }));

      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
      }

      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      const ctx = canvasRef.current.getContext('2d')!;
      frameCountRef.current = 0;

      const api = getApi();
      frameIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const jpeg = canvasRef.current.toDataURL('image/jpeg', 0.75).split(',')[1];
        const dhash = computeDhash(ctx, 640, 480);
        api.sendFrame(jpeg, dhash);
        frameCountRef.current++;
        if (frameCountRef.current % 10 === 1) {
          setDiag(d => ({ ...d, framesCaptured: frameCountRef.current }));
        }
      }, 500);

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(ms);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      audioChunkCountRef.current = 0;

      processorRef.current.onaudioprocess = (e) => {
        const data = Array.from(e.inputBuffer.getChannelData(0));
        api.sendAudioChunk(data);
        audioChunkCountRef.current++;
        if (audioChunkCountRef.current % 30 === 1) {
          setDiag(d => ({ ...d, audioChunksSent: audioChunkCountRef.current }));
        }
      };
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err: any) {
      setMediaError({
        type: 'both',
        message: err.name === 'NotAllowedError' ? '权限被拒绝，请在系统设置中允许摄像头/麦克风' :
                 err.name === 'NotFoundError' ? '未找到摄像头/麦克风设备' :
                 err.name === 'NotReadableError' ? '设备被其他应用占用' :
                 err.name + ': ' + (err.message || ''),
      });
      setDiag(d => ({ ...d, gUMStatus: 'failed', gUMError: err.name + ': ' + err.message }));
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsCapturing(false);
    setMediaError(null);
    setDiag({
      apiAvailable: false, devicesChecked: false, hasVideo: false, hasAudio: false,
      gUMStatus: '', gUMError: '', framesCaptured: 0, audioChunksSent: 0, audioTrackState: '',
    });
  }, [stream]);

  return { stream, startCapture, stopCapture, videoRef, mediaError, isCapturing, diag };
}

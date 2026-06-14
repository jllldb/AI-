import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { StatusIndicator } from './components/StatusIndicator';
import { ChatBubble } from './components/ChatBubble';
import { ControlBar } from './components/ControlBar';
import { TextInput } from './components/TextInput';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useMediaStream } from './hooks/useMediaStream';
import { useConversation } from './hooks/useConversation';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

type AspectRatio = '16:9' | '4:3' | '1:1';
type VideoSize = 'sm' | 'md' | 'lg';
type ConvMode = 'continuous' | 'ptt';

const SIZE_LABEL: Record<VideoSize, string> = { sm: '小', md: '中', lg: '大' };

export default function App() {
  const { startCapture, stopCapture, videoRef, mediaError, isCapturing, diag } = useMediaStream();
  const { state, messages, audioLevel, costSummary, sendTextMessage } = useConversation();
  const { start: startSpeech, stop: stopSpeech, isRecording, interimText } = useSpeechRecognition();

  const [cameraOn, setCameraOn] = useState(false);
  const [convMode, setConvMode] = useState<ConvMode>('ptt');
  const [ratio, setRatio] = useState<AspectRatio>('16:9');
  const [videoSize, setVideoSize] = useState<VideoSize>('md');
  const [isAccessibility, setIsAccessibility] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [modelName, setModelName] = useState('...');
  const [continuousStatus, setContinuousStatus] = useState('');
  const [whisperStatus, setWhisperStatus] = useState<{ status: string; message: string }>({ status: 'unloaded', message: '检测中...' });

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.getPreferences().then((p: any) => {
      setModelName(p?.qwenApiKey ? '千问 Qwen VL' : p?.deepseekApiKey ? 'DeepSeek' : '未知');
    }).catch(() => setModelName('未知'));

    // Poll whisper status
    const checkWhisper = async () => {
      try {
        const s = await api?.getWhisperStatus();
        if (s) setWhisperStatus(s);
      } catch {}
    };
    checkWhisper();
    const interval = setInterval(checkWhisper, 3000);
    return () => clearInterval(interval);
  }, []);

  const displayActive = cameraOn && isCapturing && !mediaError;

  const toggleMode = () => {
    const next = convMode === 'continuous' ? 'ptt' : 'continuous';
    setConvMode(next);
    (window as any).electronAPI?.setConvMode(next);
    if (next === 'continuous') {
      // Start continuous VAD+whisper mode: needs camera for audio stream
      if (!cameraOn) {
        startCapture().then(() => setCameraOn(true));
      }
      setContinuousStatus('🔊 连续对话中...（说话后自动识别）');
    } else {
      setContinuousStatus('');
    }
  };

  const startRecording = useCallback(async () => {
    if (!cameraOn) { await startCapture(); setCameraOn(true); }
    startSpeech();
  }, [cameraOn, startCapture, startSpeech]);

  const stopRecording = useCallback(async () => {
    const text = await stopSpeech();
    if (text?.trim()) await sendTextMessage(text.trim(), false);
  }, [stopSpeech, sendTextMessage]);

  const toggleAccessibility = () => {
    const next = !isAccessibility; setIsAccessibility(next);
    (window as any).electronAPI?.toggleAccessibilityMode(next);
  };

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      await stopCapture();
      setCameraOn(false);
      if (convMode === 'continuous') {
        setContinuousStatus('⚠️ 摄像头已关闭，连续对话暂停');
      }
    } else {
      await startCapture();
      setCameraOn(true);
      if (convMode === 'continuous') {
        setContinuousStatus('🔊 连续对话中...（说话后自动识别）');
      }
    }
  }, [cameraOn, startCapture, stopCapture, convMode]);

  const handleSend = async (text: string, includeFrame: boolean) => {
    await sendTextMessage(text, includeFrame);
  };

  const ratioClass = ratio === '4:3' ? 'aspect-[4/3]' : ratio === '1:1' ? 'aspect-square' : 'aspect-video';

  return (
    <div className="h-screen flex bg-gray-100">
      {/* ====== LEFT PANEL — Camera ====== */}
      <div className="w-[42%] min-w-[360px] flex flex-col bg-white border-r border-gray-200 shadow-sm">
        {/* Video */}
        <div className="p-3 pb-1">
          <div className={ratioClass}>
            <CameraPreview videoRef={videoRef} isActive={displayActive} error={mediaError} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2 flex-wrap border-t border-gray-100 mt-1">
          <StatusIndicator state={state} isRecording={isRecording} />

          <button
            onClick={toggleCamera}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-all ${
              cameraOn
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {cameraOn ? '📷 关闭' : '📷 开启'}
          </button>

          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100">
            {modelName}
          </span>

          {/* Whisper model status */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              whisperStatus.status === 'ready'
                ? 'bg-green-50 text-green-600 border-green-100'
                : whisperStatus.status === 'loading'
                ? 'bg-yellow-50 text-yellow-600 border-yellow-100 animate-pulse'
                : whisperStatus.status === 'error'
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-gray-50 text-gray-400 border-gray-100'
            }`}
            title={whisperStatus.message}
          >
            {whisperStatus.status === 'ready' ? '🗣️ 语音就绪' :
             whisperStatus.status === 'loading' ? '⬇️ 下载模型...' :
             whisperStatus.status === 'error' ? '⚠️ 语音离线' : '🗣️ ...'}
          </span>

          <span
            onClick={toggleMode}
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer border transition-colors ${
              convMode === 'continuous'
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {convMode === 'continuous' ? '🔄 连续' : '📤 按键'}
          </span>

          <div className="flex-1" />

          <span className="text-[10px] text-gray-400">尺寸</span>
          {(['sm', 'md', 'lg'] as VideoSize[]).map(s => (
            <button
              key={s}
              onClick={() => setVideoSize(s)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                videoSize === s ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >{SIZE_LABEL[s]}</button>
          ))}

          <span className="text-[10px] text-gray-400 ml-1">比例</span>
          {(['16:9', '4:3', '1:1'] as AspectRatio[]).map(r => (
            <button
              key={r}
              onClick={() => setRatio(r)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                ratio === r ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >{r}</button>
          ))}

          <span className="text-[10px] text-gray-400 ml-1 tabular-nums">¥{costSummary.todayCost.toFixed(3)}</span>
        </div>

        {/* Left panel footer hints */}
        <div className="px-3 pb-3 mt-auto">
          <div className="text-[10px] text-gray-400 text-center space-y-0.5">
            <p>💡 {convMode === 'continuous'
              ? '连续模式：说话后自动识别并回复'
              : '按键模式：按住录音，松开发送'}</p>
            <p>📷 AI 可识别视频画面内容</p>
          </div>
        </div>
      </div>

      {/* ====== RIGHT PANEL — Chat ====== */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Status bar */}
        {(isRecording || continuousStatus) && (
          <div className={`px-3 py-1.5 text-center text-xs font-medium border-b ${
            isRecording
              ? 'bg-red-50 text-red-600 border-red-100'
              : continuousStatus.startsWith('⚠️')
              ? 'bg-yellow-50 text-yellow-600 border-yellow-100'
              : 'bg-green-50 text-green-600 border-green-100'
          }`}>
            {isRecording ? `🔴 ${interimText || '正在录音...'}` : continuousStatus}
          </div>
        )}

        {/* Whisper loading banner */}
        {whisperStatus.status === 'loading' && (
          <div className="px-3 py-1.5 text-center text-xs font-medium bg-yellow-50 text-yellow-700 border-b border-yellow-100">
            ⬇️ {whisperStatus.message} — 首次使用需下载语音模型，请稍候...
          </div>
        )}
        {whisperStatus.status === 'error' && (
          <div className="px-3 py-1.5 text-center text-xs font-medium bg-red-50 text-red-600 border-b border-red-100">
            ⚠️ {whisperStatus.message} — 语音功能不可用（网络问题？）
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center mt-16">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-600 text-base font-medium mb-1">AI 视觉对话助手</p>
                <p className="text-gray-400 text-sm">
                  {convMode === 'continuous'
                    ? '打开摄像头后，直接说话即可 — AI 会自动回复'
                    : '点击 🎤 录音提问，说完点击发送'}
                </p>
                {whisperStatus.status === 'error' && (
                  <p className="text-red-500 text-xs mt-2">语音模型加载失败，请检查网络连接</p>
                )}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              content={m.content}
              visualDescription={m.visualDescription}
              timestamp={m.timestamp}
            />
          ))}
        </div>

        {/* Input + Controls */}
        <div className="border-t border-gray-200 bg-white">
          <TextInput onSend={handleSend} disabled={state === 'processing'} />
          <ControlBar
            convMode={convMode}
            isRecording={isRecording}
            isAccessibility={isAccessibility}
            onStartRecord={startRecording}
            onStopRecord={stopRecording}
            onToggleMode={toggleMode}
            onToggleAccessibility={toggleAccessibility}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHistory={() => setShowHistory(true)}
          />
        </div>
      </div>

      {/* Floating corner buttons */}
      <div className="fixed bottom-6 right-6 flex gap-2 z-40">
        <button
          onClick={() => setShowHistory(true)}
          className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-base hover:bg-gray-50 hover:shadow-xl transition-all"
          title="对话历史"
        >📋</button>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-base hover:bg-gray-50 hover:shadow-xl transition-all"
          title="设置"
        >⚙️</button>
      </div>

      {/* Modals */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  );
}

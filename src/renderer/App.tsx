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
type ConvMode = 'continuous' | 'ptt';

export default function App() {
  const { startCapture, stopCapture, videoRef, mediaError, isCapturing, diag } = useMediaStream();
  const { state, messages, audioLevel, costSummary, sendTextMessage } = useConversation();
  const { start: startSpeech, stop: stopSpeech, isRecording, interimText } = useSpeechRecognition();

  const [cameraOn, setCameraOn] = useState(false);
  const [convMode, setConvMode] = useState<ConvMode>('ptt');
  const [ratio, setRatio] = useState<AspectRatio>('16:9');
  const [isAccessibility, setIsAccessibility] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [modelName, setModelName] = useState('...');
  const [continuousStatus, setContinuousStatus] = useState('');

  useEffect(() => {
    (window as any).electronAPI?.getPreferences().then((p: any) => {
      setModelName(p?.deepseekApiKey ? 'DeepSeek' : '千问 Qwen VL');
    }).catch(() => setModelName('未知'));
    const t = setTimeout(() => { startCapture(); setCameraOn(true); }, 800);
    return () => clearTimeout(t);
  }, []);

  const displayActive = cameraOn && isCapturing && !mediaError;

  // Mode toggle
  const toggleMode = () => {
    const next = convMode === 'continuous' ? 'ptt' : 'continuous';
    setConvMode(next);
    (window as any).electronAPI?.setConvMode(next);
  };

  // PTT recording
  const startRecording = useCallback(async () => {
    if (!cameraOn) { await startCapture(); setCameraOn(true); }
    startSpeech();
  }, [cameraOn, startCapture, startSpeech]);

  const stopRecording = useCallback(async () => {
    const text = await stopSpeech();
    if (text?.trim()) await sendTextMessage(text.trim(), true);
  }, [stopSpeech, sendTextMessage]);

  const continuousRef = useRef(false);

  // Continuous mode: real-time Web Speech API → auto-message on each sentence
  const startContinuous = useCallback(async () => {
    if (!cameraOn) { await startCapture(); setCameraOn(true); }
    (window as any).electronAPI?.setConvMode('continuous');
    continuousRef.current = true;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.continuous = true;
      rec.onresult = (event: any) => {
        if (!continuousRef.current) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (text) sendTextMessage(text, true);
          }
        }
      };
      rec.onerror = () => {};
      rec.onend = () => { if (continuousRef.current) rec.start(); };
      rec.start();
      setContinuousStatus('🔊 连续对话中...（说话自动发送）');
    } else {
      setContinuousStatus('⚠️ 浏览器不支持语音识别');
    }
  }, [cameraOn, startCapture, sendTextMessage]);

  const stopContinuous = useCallback(() => {
    continuousRef.current = false;
    setContinuousStatus('');
  }, []);

  const toggleAccessibility = () => {
    const next = !isAccessibility; setIsAccessibility(next);
    (window as any).electronAPI?.toggleAccessibilityMode(next);
  };

  const handleSend = async (text: string, includeFrame: boolean) => {
    await sendTextMessage(text, includeFrame);
  };

  const ratioClass = ratio === '4:3' ? 'aspect-[4/3]' : ratio === '1:1' ? 'aspect-square' : 'aspect-video';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-3 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className={ratioClass}>
            <CameraPreview videoRef={videoRef} isActive={displayActive} error={mediaError} />
          </div>

          {/* Status row: minimal */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <StatusIndicator state={state} isRecording={isRecording} />
            {/* Model badge */}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{modelName}</span>
            {/* Mode badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium cursor-pointer ${convMode === 'continuous' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}
              onClick={toggleMode} title="点击切换对话模式">
              {convMode === 'continuous' ? '🔄 连续' : '📤 按键'}
            </span>
            {/* Video ratio */}
            <div className="ml-auto flex gap-0.5">
              {(['16:9','4:3','1:1'] as AspectRatio[]).map(r => (
                <button key={r} onClick={() => setRatio(r)}
                  className={`text-[10px] px-1 py-0.5 rounded ${ratio === r ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {r}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400">
              ¥{costSummary.todayCost.toFixed(3)}
            </span>
          </div>

          {/* Recording / Continuous status */}
          {(isRecording || continuousStatus) && (
            <div className={`mt-1 px-2 py-1 rounded text-xs border ${isRecording ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <span className={`font-medium ${isRecording ? 'text-red-500' : 'text-green-600'}`}>
                {isRecording ? '🔴 ' + (interimText || '录音中...') : continuousStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <p className="text-4xl mb-2">🤖</p>
                <p className="text-sm">
                  {convMode === 'continuous'
                    ? '点击 🔊 开始连续对话，AI 会逐句回复'
                    : '点击 🎤 录音提问，说完点击发送'}
                </p>
              </div>
            </div>
          )}
          {messages.map((m,i)=><ChatBubble key={i} role={m.role} content={m.content} visualDescription={m.visualDescription} timestamp={m.timestamp} />)}
        </div>
      </div>

      {/* Bottom controls: always visible */}
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <TextInput onSend={handleSend} disabled={state==='processing'} />
          <ControlBar
            convMode={convMode}
            isRecording={isRecording}
            isAccessibility={isAccessibility}
            onStartRecord={startRecording}
            onStopRecord={stopRecording}
            onStartContinuous={startContinuous}
            onToggleMode={toggleMode}
            onToggleAccessibility={toggleAccessibility}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHistory={() => setShowHistory(true)}
          />
        </div>
      </div>

      {/* Settings toggle chip — always visible bottom-right */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <button onClick={() => setShowHistory(true)} className="w-9 h-9 rounded-full bg-white shadow-lg border flex items-center justify-center text-sm hover:bg-gray-50" title="历史">📋</button>
        <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full bg-white shadow-lg border flex items-center justify-center text-sm hover:bg-gray-50" title="设置">⚙️</button>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  );
}

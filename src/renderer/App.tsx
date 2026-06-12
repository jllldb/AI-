import React, { useState } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { StatusIndicator } from './components/StatusIndicator';
import { ChatBubble } from './components/ChatBubble';
import { ControlBar } from './components/ControlBar';
import { TextInput } from './components/TextInput';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useMediaStream } from './hooks/useMediaStream';
import { useConversation } from './hooks/useConversation';

export default function App() {
  const { startCapture, stopCapture, videoRef, mediaError, isCapturing, diag } = useMediaStream();
  const { state, messages, transcript, audioLevel, costSummary, sendTextMessage } = useConversation();
  const [isActive, setIsActive] = useState(false);
  const [isAccessibility, setIsAccessibility] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const toggleMic = async () => {
    if (isActive) { stopCapture(); setIsActive(false); }
    else { await startCapture(); setIsActive(true); }
  };
  const toggleAccessibility = () => {
    const next = !isAccessibility; setIsAccessibility(next);
    (window as any).electronAPI?.toggleAccessibilityMode(next);
  };

  const displayActive = isActive && isCapturing && !mediaError;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto">
          <CameraPreview videoRef={videoRef} isActive={displayActive} error={mediaError} />
          <div className="flex items-center justify-between mt-3 gap-4">
            <StatusIndicator state={state} />
            {/* Audio level meter */}
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    audioLevel > 20 ? 'bg-green-500' : audioLevel > 5 ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right">{audioLevel}</span>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">¥{costSummary.todayCost.toFixed(4)}</span>
          </div>
          {/* Live transcript preview */}
          {transcript && state !== 'idle' && (
            <div className="mt-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-500 font-medium mb-0.5">
                {state === 'listening' ? '🎙️ 识别中...' : state === 'processing' ? '🤔 理解中...' : ''}
              </p>
              <p className="text-sm text-blue-800">{transcript}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-lg">点击麦克风开始对话</p></div>}
          {messages.map((m,i)=><ChatBubble key={i} role={m.role} content={m.content} visualDescription={m.visualDescription} timestamp={m.timestamp} />)}
        </div>
      </div>
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <TextInput onSend={sendTextMessage} disabled={state==='processing'} />
          <ControlBar isActive={isActive} isAccessibility={isAccessibility} onToggleMic={toggleMic}
            onToggleAccessibility={toggleAccessibility} onOpenSettings={()=>setShowSettings(true)} onOpenHistory={()=>setShowHistory(true)} />
        </div>
      </div>
      {showSettings && <SettingsPanel onClose={()=>setShowSettings(false)} />}
      {showHistory && <HistoryPanel onClose={()=>setShowHistory(false)} />}

      {/* Diagnostic panel */}
      {(isActive || mediaError) && (
        <div className="fixed bottom-20 left-4 bg-black/80 text-white rounded-lg p-3 text-xs font-mono z-40 max-w-xs">
          <p className="font-bold mb-1">🔍 诊断</p>
          <p>API可用: {diag.apiAvailable ? '✅' : '❌'}</p>
          <p>设备检测: {diag.devicesChecked ? '✅' : '⏳'} | 摄像头:{diag.hasVideo ? '✅' : '❌'} 麦克风:{diag.hasAudio ? '✅' : '❌'}</p>
          <p>getUserMedia: {diag.gUMStatus === 'success' ? '✅' : diag.gUMStatus === 'failed' ? '❌' : diag.gUMStatus === 'pending' ? '⏳' : '—'}</p>
          {diag.gUMError && <p className="text-red-400">错误: {diag.gUMError}</p>}
          <p>音频轨道: {diag.audioTrackState || '—'}</p>
          <p>帧已发送: {diag.framesCaptured} | 音频块: {diag.audioChunksSent}</p>
          <p>音频电平: {audioLevel} | 状态: {state}</p>
        </div>
      )}

      {costSummary.todayTokens > 0 && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-lg shadow p-3 text-xs text-gray-500">
          <p>💰 今日: ¥{costSummary.todayCost.toFixed(4)}</p>
          <p>🛡 VAD节省: {costSummary.callsSavedByVAD}次</p>
          <p>🖼 去重节省: {costSummary.callsSavedByDedup}次</p>
          <p>💾 缓存命中: {costSummary.callsSavedByCache}次</p>
        </div>
      )}
    </div>
  );
}

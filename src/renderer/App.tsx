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
  const { startCapture, stopCapture, videoRef } = useMediaStream();
  const { state, messages, costSummary, sendTextMessage } = useConversation();
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto">
          <CameraPreview videoRef={videoRef} isActive={isActive} />
          <div className="flex items-center justify-between mt-3">
            <StatusIndicator state={state} />
            <span className="text-xs text-gray-400">今日: ¥{costSummary.todayCost.toFixed(4)} · {costSummary.todayTokens} tokens</span>
          </div>
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

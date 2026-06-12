import React, { useState, useEffect } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { StatusIndicator } from './components/StatusIndicator';
import { ChatBubble } from './components/ChatBubble';
import { ControlBar } from './components/ControlBar';
import { TextInput } from './components/TextInput';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useMediaStream } from './hooks/useMediaStream';
import { ConversationProvider, useConversationContext } from './context/ConversationContext';
import { PreferencesProvider, usePreferencesContext } from './context/PreferencesContext';
import { getApi } from './lib/electron-api';

function AppContent() {
  const { startCapture, stopCapture, videoRef, mediaError, isCapturing, diag } = useMediaStream();
  const { state, messages, transcript, audioLevel, costSummary, sendTextMessage } = useConversationContext();
  const { preferences } = usePreferencesContext();
  const [isActive, setIsActive] = useState(false);
  const [isAccessibility, setIsAccessibility] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [modelName, setModelName] = useState('...');

  useEffect(() => {
    const provider = preferences.modelProvider || 'qwen';
    const names: Record<string, string> = {
      qwen: '千问 Qwen VL', deepseek: 'DeepSeek', openai: 'OpenAI',
      gemini: 'Gemini', claude: 'Claude', auto: '自动',
    };
    if (preferences.modelProvider) setModelName(names[provider] || provider);
  }, [preferences]);

  const toggleMic = async () => {
    if (isActive) { stopCapture(); setIsActive(false); }
    else { await startCapture(); setIsActive(true); }
  };
  const toggleAccessibility = () => {
    const next = !isAccessibility; setIsAccessibility(next);
    getApi().toggleAccessibilityMode(next);
  };

  const displayActive = isActive && isCapturing && !mediaError;

  const handleSend = async (text: string, includeFrame: boolean) => {
    await sendTextMessage(text, includeFrame);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-3 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto">
          <CameraPreview videoRef={videoRef} isActive={displayActive} error={mediaError} />

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusIndicator state={state} />
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">🤖 {modelName}</span>

            {isCapturing && (
              <div className="flex items-center gap-1 flex-1 min-w-[60px]">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
                  <div className={`h-full rounded-full transition-all duration-100 ${
                    audioLevel > 20 ? 'bg-green-500' : audioLevel > 5 ? 'bg-yellow-400' : 'bg-gray-300'
                  }`} style={{ width: `${audioLevel}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 w-6">{audioLevel}</span>
              </div>
            )}

            <span className="text-[10px] text-gray-400 ml-auto">
              ¥{costSummary.todayCost.toFixed(4)} | {costSummary.todayTokens}t
            </span>
          </div>

          {transcript && state !== 'idle' && (
            <div className="mt-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-700">
              {state === 'listening' ? '🎙️ ' : state === 'processing' ? '🤔 ' : ''}{transcript}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-300 text-5xl mb-4">🤖</p>
                <p className="text-gray-400 text-lg">AI 视觉对话助手</p>
                <p className="text-gray-300 text-sm mt-1">
                  {displayActive ? '对着麦克风说话，或输入文字' : '点击 🎤 开始，或输入文字对话'}
                </p>
                {isCapturing && (
                  <div className="mt-3 text-[10px] text-gray-400 font-mono space-y-0.5">
                    <p>📷 帧:{diag.framesCaptured} 🎤 块:{diag.audioChunksSent} 📶 电平:{audioLevel}</p>
                    <p>📹 {diag.gUMStatus==='success'?'✅':'❌'} 🎙️ {diag.audioTrackState||'—'} {diag.gUMError||''}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {messages.map((m,i)=><ChatBubble key={i} role={m.role} content={m.content} visualDescription={m.visualDescription} timestamp={m.timestamp} />)}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <TextInput onSend={handleSend} disabled={state==='processing'} />
          <ControlBar
            isActive={isActive} isAccessibility={isAccessibility}
            onToggleMic={toggleMic}
            onToggleAccessibility={toggleAccessibility}
            onOpenSettings={()=>setShowSettings(true)}
            onOpenHistory={()=>setShowHistory(true)}
          />
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={()=>setShowSettings(false)} />}
      {showHistory && <HistoryPanel onClose={()=>setShowHistory(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <ConversationProvider>
        <AppContent />
      </ConversationProvider>
    </PreferencesProvider>
  );
}

import React from 'react';

interface Props {
  convMode: 'continuous' | 'ptt';
  isRecording: boolean;
  isAccessibility: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onToggleMode: () => void;
  onToggleAccessibility: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const ControlBar: React.FC<Props> = ({
  convMode, isRecording, isAccessibility,
  onStartRecord, onStopRecord,
  onToggleMode, onToggleAccessibility,
}) => (
  <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-100">
    {convMode === 'ptt' ? (
      <>
        {/* PTT record button */}
        <button
          onClick={isRecording ? onStopRecord : onStartRecord}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-200 shadow-lg ${
            isRecording
              ? 'bg-red-500 text-white shadow-red-200 scale-110 animate-pulse'
              : 'bg-blue-500 text-white shadow-blue-200 hover:bg-blue-600 hover:scale-105 active:scale-95'
          }`}
          title={isRecording ? '停止录音并发送' : '开始录音'}
        >
          {isRecording ? '📤' : '🎤'}
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isRecording ? '点击发送' : '点击录音'}
          </p>
          <p className="text-[10px] text-gray-400">
            {isRecording ? '说完点击发送按钮' : '点击录音，松开发送'}
          </p>
        </div>
      </>
    ) : (
      <>
        {/* Continuous mode indicator — VAD+whisper handles everything automatically */}
        <div className="w-14 h-14 rounded-full bg-green-500 text-white shadow-lg shadow-green-200 flex items-center justify-center text-2xl">
          🔊
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">连续对话模式</p>
          <p className="text-[10px] text-green-500">直接说话，AI 自动回复</p>
        </div>
      </>
    )}

    {/* Divider */}
    <div className="w-px h-8 bg-gray-200" />

    {/* Mode switch */}
    <button
      onClick={onToggleMode}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
        convMode === 'continuous'
          ? 'bg-white text-green-600 border-green-200 hover:bg-green-50'
          : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
      }`}
      title="切换对话模式"
    >
      {convMode === 'continuous' ? '📤 按键模式' : '🔄 连续模式'}
    </button>

    {/* Accessibility toggle */}
    <button
      onClick={onToggleAccessibility}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all border ${
        isAccessibility
          ? 'bg-purple-100 text-purple-600 border-purple-200'
          : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
      }`}
      title={isAccessibility ? '关闭无障碍模式' : '开启无障碍模式（自动描述画面）'}
    >
      ♿
    </button>
  </div>
);

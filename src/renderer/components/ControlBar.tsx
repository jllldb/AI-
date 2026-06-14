import React from 'react';

interface Props {
  convMode: 'continuous' | 'ptt';
  isRecording: boolean;
  isAccessibility: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onStartContinuous: () => void;
  onToggleMode: () => void;
  onToggleAccessibility: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const ControlBar: React.FC<Props> = ({
  convMode, isRecording, isAccessibility,
  onStartRecord, onStopRecord, onStartContinuous, onToggleMode, onToggleAccessibility,
}) => (
  <div className="flex items-center justify-center gap-2 py-2">
    {convMode === 'ptt' ? (
      <>
        <button onClick={isRecording ? onStopRecord : onStartRecord}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
            isRecording
              ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
              : 'bg-blue-500 text-white shadow-lg hover:bg-blue-600'
          }`}>
          {isRecording ? '📤' : '🎤'}
        </button>
        <span className="text-[11px] text-gray-400">
          {isRecording ? '点击发送' : '点击录音'}
        </span>
      </>
    ) : (
      <>
        <button onClick={onStartContinuous}
          className="w-12 h-12 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 flex items-center justify-center text-xl">
          🔊
        </button>
        <span className="text-[11px] text-gray-400">连续对话中</span>
      </>
    )}

    <span className="text-gray-300 mx-1">|</span>

    <button onClick={onToggleMode}
      className={`text-[11px] px-2 py-1 rounded ${convMode === 'continuous' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
      {convMode === 'continuous' ? '切换按键' : '切换连续'}
    </button>

    <button onClick={onToggleAccessibility}
      className={`text-[11px] px-2 py-1 rounded ${isAccessibility ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}>
      ♿
    </button>
  </div>
);

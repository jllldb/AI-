import React from 'react';
interface Props {
  isActive: boolean; isAccessibility: boolean;
  onToggleMic: () => void; onToggleAccessibility: () => void;
  onOpenSettings: () => void; onOpenHistory: () => void;
}
export const ControlBar: React.FC<Props> = ({ isActive, isAccessibility, onToggleMic, onToggleAccessibility, onOpenSettings, onOpenHistory }) => (
  <div className="flex items-center justify-center gap-3 py-3">
    <button onClick={onToggleMic}
      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
        isActive ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}>
      🎤
    </button>
    <button onClick={onToggleAccessibility}
      className={`px-3 py-2 rounded-lg text-sm font-medium ${isAccessibility ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
      ♿ {isAccessibility ? '描述中' : '辅助'}
    </button>
    <button onClick={onOpenHistory} className="px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-600 hover:bg-gray-300">📋 历史</button>
    <button onClick={onOpenSettings} className="px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-600 hover:bg-gray-300">⚙️ 设置</button>
  </div>
);

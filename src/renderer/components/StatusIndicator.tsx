import React from 'react';
import { ConversationState } from '../../shared/types';
const LABELS: Record<ConversationState, { label: string; color: string; icon: string }> = {
  idle: { label: '就绪', color: 'bg-gray-400', icon: '⏸' },
  listening: { label: '正在听...', color: 'bg-red-500', icon: '🎙️' },
  processing: { label: 'AI 思考中...', color: 'bg-yellow-500', icon: '🤔' },
  speaking: { label: 'AI 回复中', color: 'bg-green-500', icon: '🔊' },
};
export const StatusIndicator: React.FC<{ state: ConversationState }> = ({ state }) => {
  const info = LABELS[state];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full">
      <span className={`w-2.5 h-2.5 rounded-full ${info.color} ${state === 'listening' || state === 'processing' ? 'animate-pulse' : ''}`} />
      <span className="text-white text-xs font-medium">{info.icon} {info.label}</span>
    </div>
  );
};

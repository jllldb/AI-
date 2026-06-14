import React from 'react';

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: string;
  visualDescription?: string;
  timestamp?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export const ChatBubble: React.FC<Props> = ({ role, content, visualDescription, timestamp }) => {
  // System message: centered banner
  if (role === 'system') {
    return (
      <div className="flex justify-center mb-3">
        <div className="px-4 py-1.5 bg-purple-50 border border-purple-200 rounded-full text-purple-700 text-xs font-medium max-w-[85%] text-center">
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white'
          }`}
        >
          {isUser ? '👤' : '🤖'}
        </div>

        {/* Bubble */}
        <div className={`group ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Visual description card */}
          {visualDescription && (
            <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs border backdrop-blur ${
              isUser
                ? 'bg-blue-100/80 border-blue-200 text-blue-700 rounded-br-sm'
                : 'bg-amber-50 border-amber-200 text-amber-800 rounded-bl-sm'
            }`}>
              <span className="font-medium">👁️ 画面：</span>
              {visualDescription}
            </div>
          )}

          {/* Main content */}
          <div
            className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
              isUser
                ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-100'
            }`}
          >
            {content}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <p className={`text-[10px] mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              isUser ? 'text-right text-gray-400' : 'text-left text-gray-400'
            }`}>
              {formatTime(timestamp)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

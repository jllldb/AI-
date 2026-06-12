import React from 'react';
interface Props { role: 'user' | 'assistant' | 'system'; content: string; visualDescription?: string; timestamp?: number; }

function bubbleClass(role: string): string {
  if (role === 'system') return 'bg-purple-50 border border-purple-200 text-purple-900';
  if (role === 'user') return 'bg-blue-500 text-white';
  return 'bg-gray-100 text-gray-900';
}

function subTextClass(role: string): string {
  return role === 'user' ? 'text-blue-100' : 'text-gray-500';
}

function timeClass(role: string): string {
  return role === 'user' ? 'text-blue-200' : 'text-gray-400';
}

export const ChatBubble: React.FC<Props> = ({ role, content, visualDescription, timestamp }) => {
  const isUser = role === 'user';
  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start') + ' mb-3'}>
      <div className={'max-w-[75%] rounded-2xl px-4 py-3 ' + bubbleClass(role)}>
        {visualDescription && <p className={'text-xs mb-1 ' + subTextClass(role)}>👁️ {visualDescription}</p>}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {timestamp && <p className={'text-xs mt-1 ' + timeClass(role)}>{new Date(timestamp).toLocaleTimeString('zh-CN')}</p>}
      </div>
    </div>
  );
};

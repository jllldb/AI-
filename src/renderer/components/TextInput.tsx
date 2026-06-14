import React, { useState } from 'react';

export const TextInput: React.FC<{
  onSend: (text: string, includeFrame: boolean) => void;
  disabled: boolean;
}> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [includeFrame, setIncludeFrame] = useState(false);

  const handle = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim(), includeFrame);
    setText('');
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {/* Attach image toggle */}
      <label
        className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs cursor-pointer transition-all border ${
          includeFrame
            ? 'bg-blue-50 text-blue-600 border-blue-200'
            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
        }`}
      >
        <input
          type="checkbox"
          checked={includeFrame}
          onChange={e => setIncludeFrame(e.target.checked)}
          className="sr-only"
        />
        📷 {includeFrame ? '附图' : '无图'}
      </label>

      {/* Text input */}
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="输入文字消息，或直接录音..."
        disabled={disabled}
        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-40 placeholder-gray-400 transition-all"
      />

      {/* Send button */}
      <button
        onClick={handle}
        disabled={disabled || !text.trim()}
        className="px-5 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        发送
      </button>
    </div>
  );
};

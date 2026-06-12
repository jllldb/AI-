import React, { useState } from 'react';
export const TextInput: React.FC<{ onSend: (text: string, includeFrame: boolean) => void; disabled: boolean }> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [includeFrame, setIncludeFrame] = useState(true);
  const handle = () => { if (!text.trim() || disabled) return; onSend(text.trim(), includeFrame); setText(''); };
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-200">
      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
        <input type="checkbox" checked={includeFrame} onChange={e => setIncludeFrame(e.target.checked)} className="rounded" />📷 附图
      </label>
      <input type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="输入文字消息..." disabled={disabled}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
      <button onClick={handle} disabled={disabled || !text.trim()}
        className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 disabled:opacity-50">发送</button>
    </div>
  );
};

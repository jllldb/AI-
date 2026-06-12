import React, { useState, useEffect } from 'react';
import { ConversationTurn } from '../../shared/types';
export const HistoryPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => { (window as any).electronAPI?.getHistory(search || undefined).then(setTurns); }, [search]);
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-bold">对话历史</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
      </div>
      <div className="p-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索对话..." className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {turns.map(t => (
          <div key={t.id} className={`p-3 rounded-lg ${t.role === 'user' ? 'bg-blue-50 ml-4' : t.role === 'system' ? 'bg-purple-50' : 'bg-gray-50 mr-4'}`}>
            <p className="text-xs text-gray-400 mb-1">
              {t.role === 'user' ? '👤' : t.role === 'system' ? '🤖' : '🤖'} {new Date(t.timestamp).toLocaleString('zh-CN')} · {t.modelUsed}
            </p>
            {t.visualDescription && <p className="text-xs text-purple-600 mb-1">👁️ {t.visualDescription}</p>}
            <p className="text-sm">{t.content}</p>
          </div>
        ))}
        {turns.length === 0 && <p className="text-center text-gray-400 py-8">暂无记录</p>}
      </div>
    </div>
  );
};

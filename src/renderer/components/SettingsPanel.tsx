import React, { useState, useEffect } from 'react';

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (window as any).electronAPI?.getPreferences().then((p: Record<string, string>) => {
      setPrefs(p || {});
    });
  }, []);

  const update = (k: string, v: string) => {
    setPrefs(p => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const saveAll = async () => {
    await (window as any).electronAPI?.setPreferences(prefs);
    setDirty(false);
    setSaved(true);
    // Reload conversation manager with new keys
    window.location.reload();
  };

  const VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声, 活泼)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男声, 叙事)' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声, 温柔)' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男声, 新闻)' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女声, 自然)' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col m-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">⚙️ 设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* API Keys */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🔑 API 密钥</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  千问 API Key {prefs.qwenApiKey ? '✅' : '❌'}
                </label>
                <input
                  type="password"
                  value={prefs.qwenApiKey || ''}
                  onChange={e => update('qwenApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  DeepSeek API Key {prefs.deepseekApiKey ? '✅' : '⬜ (可选)'}
                </label>
                <input
                  type="password"
                  value={prefs.deepseekApiKey || ''}
                  onChange={e => update('deepseekApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* TTS */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🔊 语音合成</h3>
            <div>
              <label className="text-xs text-gray-500">音色</label>
              <select
                value={prefs.ttsVoice || 'zh-CN-XiaoxiaoNeural'}
                onChange={e => update('ttsVoice', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
              >
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-500">语速: {prefs.ttsRate || '1.0'}x</label>
              <input
                type="range" min="0.5" max="2.0" step="0.1"
                value={prefs.ttsRate || '1.0'}
                onChange={e => update('ttsRate', e.target.value)}
                className="w-full mt-1"
              />
            </div>
          </section>

          {/* Budget */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 每日预算上限</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={prefs.dailyBudget || '5'}
                onChange={e => update('dailyBudget', e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg text-sm" min="0"
              />
              <span className="text-sm text-gray-500">元/天 (0 = 不限)</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {saved ? '✅ 已保存，即将刷新...' : dirty ? '⚠️ 有未保存的更改' : ''}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
              <button
                onClick={saveAll}
                disabled={!dirty}
                className={`px-5 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                  dirty ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                保存并应用
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

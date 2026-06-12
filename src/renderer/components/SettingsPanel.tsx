import React, { useState, useEffect } from 'react';
export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  useEffect(() => { (window as any).electronAPI?.getPreferences().then(setPrefs); }, []);
  const save = async (k: string, v: string) => {
    const np = { ...prefs, [k]: v }; setPrefs(np);
    await (window as any).electronAPI?.setPreferences({ [k]: v });
  };
  const VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声)' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男声)' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女声)' },
  ];
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-bold">设置</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section><h3 className="text-sm font-semibold mb-3">API 密钥</h3>
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">千问 API Key</label>
              <input type="password" value={prefs.qwenApiKey||''} onChange={e=>save('qwenApiKey',e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1"/></div>
            <div><label className="text-xs text-gray-500">DeepSeek API Key</label>
              <input type="password" value={prefs.deepseekApiKey||''} onChange={e=>save('deepseekApiKey',e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1"/></div>
          </div>
        </section>
        <section><h3 className="text-sm font-semibold mb-3">TTS 音色</h3>
          <select value={prefs.ttsVoice||'zh-CN-XiaoxiaoNeural'} onChange={e=>save('ttsVoice',e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            {VOICES.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </section>
        <section><h3 className="text-sm font-semibold mb-3">TTS 语速: {prefs.ttsRate||'1.0'}x</h3>
          <input type="range" min="0.5" max="2.0" step="0.1" value={prefs.ttsRate||'1.0'} onChange={e=>save('ttsRate',e.target.value)} className="w-full"/></section>
        <section><h3 className="text-sm font-semibold mb-3">每日预算 (元)</h3>
          <input type="number" value={prefs.dailyBudget||'5'} onChange={e=>save('dailyBudget',e.target.value)} className="w-32 px-3 py-2 border rounded-lg text-sm" min="0"/></section>
        <section><h3 className="text-sm font-semibold mb-3">无障碍模式间隔</h3>
          <select value={prefs.accessibilityInterval||'5'} onChange={e=>save('accessibilityInterval',e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="3">每 3 秒</option><option value="5">每 5 秒</option><option value="10">每 10 秒</option><option value="30">每 30 秒</option>
          </select>
        </section>
      </div>
    </div>
  );
};

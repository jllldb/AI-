import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  {
    id: 'qwen', name: '阿里云 千问 (Qwen VL)', color: 'blue',
    desc: '国产首选 · 图文理解最强 · 开源可本地部署',
    link: 'https://dashscope.aliyun.com',
    keyField: 'qwenApiKey', modelField: 'qwenModel', defaultModel: 'qwen-vl-plus',
  },
  {
    id: 'deepseek', name: 'DeepSeek', color: 'green',
    desc: '极致性价比 · 代码推理强 · token 成本最低',
    link: 'https://platform.deepseek.com',
    keyField: 'deepseekApiKey', modelField: 'deepseekModel', defaultModel: 'deepseek-chat',
  },
  {
    id: 'openai', name: 'OpenAI (GPT-4o)', color: 'emerald',
    desc: '多模态标杆 · 生态最成熟 · 全球最强综合能力',
    link: 'https://platform.openai.com',
    keyField: 'openaiApiKey', modelField: 'openaiModel', defaultModel: 'gpt-4o',
  },
  {
    id: 'gemini', name: 'Google Gemini', color: 'amber',
    desc: '原生多模态 · 超长上下文 1M · 性价比高',
    link: 'https://aistudio.google.com',
    keyField: 'geminiApiKey', modelField: 'geminiModel', defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'claude', name: 'Anthropic Claude', color: 'orange',
    desc: '深度推理 · 安全对齐 · 长文本理解优异',
    link: 'https://console.anthropic.com',
    keyField: 'claudeApiKey', modelField: 'claudeModel', defaultModel: 'claude-sonnet-4-6',
  },
];

const colorMap: Record<string, string> = {
  blue: 'border-blue-300 bg-blue-50',
  green: 'border-green-300 bg-green-50',
  emerald: 'border-emerald-300 bg-emerald-50',
  amber: 'border-amber-300 bg-amber-50',
  orange: 'border-orange-300 bg-orange-50',
};

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (window as any).electronAPI?.getPreferences().then((p: Record<string, string>) => setPrefs(p || {}));
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
    window.location.reload();
  };

  const hasKey = (field: string) => !!(prefs[field] && prefs[field].trim());
  const currentProvider = prefs.modelProvider || 'qwen';

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col m-2">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">⚙️ 设置</h2>
            <p className="text-xs text-gray-400">配置 AI 模型和 API 密钥</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Model Provider Selection */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🤖 首选模型供应商</h3>
            <select
              value={currentProvider}
              onChange={e => update('modelProvider', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">🤖 自动选择（优先有 Key 的供应商）</option>
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              视觉/语音场景自动使用支持多模态的供应商
            </p>
          </section>

          {/* API Keys */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🔑 API 密钥</h3>
            <p className="text-[10px] text-gray-400 mb-3">
              至少配置一个供应商即可使用。密钥仅存储在本地，不会上传。
            </p>
            <div className="space-y-3">
              {PROVIDERS.map(p => {
                const key = hasKey(p.keyField);
                return (
                  <div key={p.id} className={`rounded-lg p-3 border ${colorMap[p.color]} ${currentProvider === p.id ? 'ring-2 ring-offset-1' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{p.name}</span>
                      <span className={`text-xs ${key ? 'text-green-600' : 'text-gray-400'}`}>
                        {key ? '✅ 已配置' : '⬜ 未配置'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">{p.desc}</p>
                    <input
                      type="password"
                      value={prefs[p.keyField] || ''}
                      onChange={e => update(p.keyField, e.target.value)}
                      placeholder="输入 API Key..."
                      className="w-full px-3 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      <a href={p.link} className="underline hover:text-blue-500" target="_blank">获取 Key →</a>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* TTS */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🔊 语音合成</h3>
            <select
              value={prefs.ttsVoice || 'zh-CN-XiaoxiaoNeural'}
              onChange={e => update('ttsVoice', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
            >
              <option value="zh-CN-XiaoxiaoNeural">晓晓 (女声, 活泼)</option>
              <option value="zh-CN-YunxiNeural">云希 (男声, 叙事)</option>
              <option value="zh-CN-XiaoyiNeural">晓伊 (女声, 温柔)</option>
              <option value="zh-CN-YunyangNeural">云扬 (男声, 新闻)</option>
              <option value="zh-CN-XiaochenNeural">晓辰 (女声, 自然)</option>
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">语速:</span>
              <input type="range" min="0.5" max="2.0" step="0.1" value={prefs.ttsRate || '1.0'}
                onChange={e => update('ttsRate', e.target.value)} className="flex-1" />
              <span className="text-xs text-gray-500 w-8">{prefs.ttsRate || '1.0'}x</span>
            </div>
          </section>

          {/* Budget */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 每日预算上限</h3>
            <div className="flex items-center gap-2">
              <input type="number" value={prefs.dailyBudget || '5'}
                onChange={e => update('dailyBudget', e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg text-sm" min="0" />
              <span className="text-sm text-gray-500">元/天 (0 = 不限)</span>
            </div>
          </section>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {saved ? '✅ 已保存，刷新中...' : dirty ? '⚠️ 有未保存的更改' : '配置未变更'}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
              <button onClick={saveAll} disabled={!dirty}
                className={`px-5 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                  dirty ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'
                }`}>
                保存并应用
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

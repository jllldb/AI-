# AI 视觉对话助手 — 设计规格说明书

> **版本**: v1.0  
> **日期**: 2026-06-12  
> **状态**: 设计完成，待进入实现计划

---

## 1. 产品概述

### 1.1 产品定义

AI 视觉对话助手是一款 **Electron 桌面应用**，打开摄像头与麦克风，让 AI 能够实时看到视频画面、听到用户说话，并以语音 + 文字给予自然回应。核心定位为**通用全能型视觉对话助手**，兼顾无障碍辅助与日常生活场景。

### 1.2 核心能力

| 能力 | 描述 |
|------|------|
| 📷 视觉理解 | 摄像头实时画面理解，空间推理、物体识别、场景描述 |
| 🎙️ 语音交互 | 自然语音对话，连续多轮对话（v1 暂不做实时打断） |
| 🧠 智能推理 | 结合视觉上下文进行推理、答疑、建议 |
| ♿ 无障碍模式 | 为视障用户主动描述周围环境变化 |
| 💰 成本可控 | 多层省钱机制，中度使用约 ¥0.35/天 |

> **v1 范围说明**：实时打断（barge-in）需要音频流式处理全双工架构，复杂度高。v1 采用"说完-处理-回复"的半双工模式，对话体验仍流畅（延迟 < 3s）。实时打断留待 v2。

### 1.3 模型策略

采用 **千问 Qwen3.5-Omni + DeepSeek V4 混合路由**：

- **千问 Qwen3.5-Omni**：处理多模态输入（摄像头画面 + 语音），原生 Thinker-Talker 端到端架构
- **DeepSeek V4**：处理纯文字对话推理，token 成本低
- **Edge TTS**：本地免费语音合成，零 API 成本

---

## 2. 系统架构

### 2.1 总架构：端云协同五层模型

```
┌─────────────────────────────────────────────┐
│              表示层 (Presentation)             │
│     Electron 渲染进程 | React + Tailwind       │
│     摄像头预览 / 对话气泡 / 状态指示 / 设置      │
├─────────────────────────────────────────────┤
│              本地端 (Local — Main Process)      │
│  ┌──────────┬──────────┬──────────┬────────┐ │
│  │ 视频采集  │ 音频采集  │ VAD 检测 │ 帧去重  │ │
│  │ 2fps抽帧 │ 16kHz    │ -40dBFS  │ dhash  │ │
│  ├──────────┼──────────┼──────────┼────────┤ │
│  │TTS 合成  │上下文管理│ 模型路由  │ 缓存    │ │
│  │Edge TTS  │ 滑动窗口 │ 决策调度  │ 特征缓存│ │
│  └──────────┴──────────┴──────────┴────────┘ │
├─────────────────────────────────────────────┤
│              网络层 (IPC + HTTP)              │
│     Electron IPC (主进程↔渲染进程) +          │
│     HTTPS API (千问 / DeepSeek)               │
├─────────────────────────────────────────────┤
│              云端 (Cloud APIs)                 │
│  ┌─────────────────┬──────────────────────┐  │
│  │ 千问 Qwen Omni   │  DeepSeek V4         │  │
│  │ 视觉+语音+回复   │  纯文字推理+流式      │  │
│  └─────────────────┴──────────────────────┘  │
├─────────────────────────────────────────────┤
│              持久层 (Persistence)              │
│       本地 SQLite | 对话历史 / 偏好设置         │
└─────────────────────────────────────────────┘
```

### 2.2 端云边界原则

| 在本地做 | 原因 |
|----------|------|
| 摄像头采集 + 抽帧 (2fps) | 硬件直接访问，全帧率上传不现实 |
| VAD 静音检测 | 避免对空音频调用 API，节省 60-70% 音频调用 |
| 帧去重 (dhash 汉明距离) | 避免对重复画面重复调用视觉 API，节省 50-80% |
| TTS 语音合成 (Edge TTS) | 完全免费，自然度满足需求 |
| 上下文压缩 | 减少发送 token 数，控制每次调用成本 |
| 对话历史存储 (SQLite) | 隐私保护，离线可查 |

| 在云端做 | 原因 |
|----------|------|
| 图像内容理解 | 需要大模型视觉能力 |
| 语音识别 (ASR) | 千问 Omni 端到端精度远超本地小模型 |
| 对话推理与生成 | 核心智能，必须云端大模型 |

---

## 3. 技术栈

| 层 | 技术 | 版本/说明 |
|----|------|----------|
| 桌面框架 | Electron | >= 28.x |
| 前端框架 | React | 18.x + TypeScript |
| 样式 | Tailwind CSS | 3.x |
| 构建工具 | Vite (渲染进程) + electron-builder | |
| 主进程语言 | TypeScript | |
| 持久化 | better-sqlite3 | 本地 SQLite |
| 视觉 API | 千问 Qwen3.5-Omni (DashScope SDK) | 用户提供 |
| 文字 API | DeepSeek V4 | |
| TTS | Edge TTS (系统内置) | 通过 `node-edge-tts` |
| VAD | `@ricky0123/vad-web` 或自研 RMS | 静音阈值 -40 dBFS |
| 帧去重 | dhash (自研) | 汉明距离 ≤ 5 |

---

## 4. 核心对话闭环

### 4.1 时序流程

```
用户说话 + 画面变化
       │
       ▼
① 本地采集 ──── 音频流 (16kHz mono) + 视频帧 (2fps, 640×480, JPEG Q75)
       │
       ▼
② 预处理 ──── VAD 检测语音段 + dhash 帧去重
       │         ├─ 静音 → 跳过，不发送
       │         ├─ 重复帧 → 跳过，不发送
       │         └─ 有效 → 继续
       ▼
③ 发送千问 ──── 音频段 + 最新关键帧 → Qwen3.5-Omni API
       │
       ▼
④ 千问返回 ──── { transcription, visual_description, response_text, emotion }
       │
       ▼
⑤ 路由判断 ──── 用户追问且无新图像？→ DeepSeek 流式推理
       │         仍有视觉上下文？→ 千问直接回复（或追加调用）
       ▼
⑥ 生成回复 ──── 文本回复 + 情感标记
       │
       ▼
⑦ 本地输出 ──── Edge TTS 合成语音 + UI 渲染对话气泡
       │
       ▼
    用户听到 + 看到回复，循环继续
```

### 4.2 关键参数

| 参数 | 值 | 说明 |
|------|----|------|
| 抽帧频率 | 2 fps | 对话场景够用 |
| 帧分辨率 | 640×480 | 千问支持任意分辨率 |
| JPEG 质量 | 75% | 视觉精度几乎无损 |
| VAD 静音阈值 | -40 dBFS | 低于此值视为静音 |
| VAD 截断静音时长 | 1.5s | 停顿 1.5 秒认为说完 |
| 帧去重阈值 | 汉明距离 ≤ 5 | 相似度 >95% 视为重复 |
| 上下文窗口 | 最近 10 轮 | 超出后压缩旧消息为摘要 |

### 4.3 模型路由决策逻辑

```
输入类型判断:
├─ 有新图像 + 有语音 → 千问 Omni（全模态，一站式处理）
├─ 有新图像 + 无语音 → 千问 Omni（视觉理解 + 场景描述）
├─ 无新图像 + 有语音 → 千问 Omni（语音→文字→回复）
│   └─ 后续追问 → DeepSeek（纯文字流式推理，低成本）
├─ 无新图像 + 无语音 + 文字输入 → DeepSeek（纯文字，最便宜）
└─ 无障碍连续模式 → 千问 Omni + 帧去重缓存优化
```

---

## 5. 组件架构

### 5.1 目录结构

```
ai-visual-assistant/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   # 入口，窗口管理
│   │   ├── ipc-handlers.ts            # IPC 通信注册
│   │   ├── services/
│   │   │   ├── media-service.ts       # 摄像头/麦克风采集 (getUserMedia)
│   │   │   ├── vad-service.ts         # 静音检测 (RMS/VAD)
│   │   │   ├── frame-dedup.ts         # 帧去重 (dhash + 汉明距离)
│   │   │   ├── tts-service.ts         # Edge TTS 本地合成
│   │   │   └── context-manager.ts     # 上下文窗口管理 + 摘要压缩
│   │   ├── clients/
│   │   │   ├── qwen-client.ts         # 千问 Omni API 封装
│   │   │   └── deepseek-client.ts     # DeepSeek API 封装
│   │   ├── router/
│   │   │   └── model-router.ts        # 模型路由决策引擎
│   │   └── store/
│   │       ├── conversation-store.ts  # SQLite 对话历史 CRUD
│   │       └── preference-store.ts    # 用户设置持久化
│   ├── preload/
│   │   └── index.ts                   # contextBridge 安全暴露 API
│   └── renderer/                      # React 渲染进程
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── CameraPreview.tsx       # 摄像头实时预览
│       │   ├── ChatBubble.tsx          # 对话气泡 (用户/AI)
│       │   ├── StatusIndicator.tsx     # 状态指示器 (录音中/处理中/播放中)
│       │   ├── ControlBar.tsx          # 底部控制栏 (麦克风/文字/设置)
│       │   ├── SettingsPanel.tsx       # 设置面板 (API Key/参数)
│       │   ├── HistoryPanel.tsx        # 对话历史列表 + 搜索 (US9)
│       │   └── TextInput.tsx           # 文字输入框 (US8)
│       └── hooks/
│           ├── useConversation.ts      # 对话状态管理
│           ├── useMediaStream.ts       # 音视频流管理
│           └── useIPC.ts               # IPC 调用封装
└── assets/
    └── icon.png
```

### 5.2 主进程核心服务职责

| 服务 | 职责 | 对外接口 |
|------|------|---------|
| MediaService | 管理 getUserMedia 流，抽帧 2fps，音频分段 | `startCapture()`, `stopCapture()`, `onFrame`, `onAudioSegment` |
| VADService | 实时音频 RMS 计算，检测语音段起止 | `isSilence(audioBuffer): boolean`, `onSpeechSegment` |
| FrameDedup | dhash 计算 + 汉明距离比对 | `isDuplicate(frame): boolean`, `getKeyFrames()` |
| TTSService | Edge TTS 流式合成，音色/语速调节 | `synthesize(text, voice, rate): AudioBuffer` |
| ContextManager | 滑动窗口 + 旧消息摘要压缩 | `addTurn(turn)`, `getContext(): ContextWindow` |
| ModelRouter | 输入特征 → 模型选择决策 | `route(input: ConversationInput): ModelChoice` |

**核心类型定义：**

```typescript
type ModelChoice = 'qwen-omni' | 'deepseek';

interface ConversationInput {
  hasNewImage: boolean;
  hasSpeech: boolean;
  hasTextInput: boolean;
  isAccessibilityMode: boolean;
  isFollowUp: boolean;       // 是否是对上一条回复的追问
}

interface QwenResponse {
  transcription: string;       // 语音转文字结果
  visualDescription: string;   // 画面内容描述
  responseText: string;        // AI 文字回复
  emotion?: string;            // 检测到的用户情绪
}
```
| QwenClient | 千问 Omni API，支持多模态输入 | `chat({audio?, image?, text?}): QwenResponse` |
| DeepSeekClient | DeepSeek API，支持流式输出 | `chatStream(messages): AsyncIterable<string>` |

---

## 6. 用户故事

### 6.1 计划实现 vs 实际实现（待跟踪）

#### 🟢 P0 — 核心闭环（必须实现）

| # | 用户故事 | 计划 | 实际 | 验收标准 |
|---|---------|:--:|:--:|---------|
| US1 | 打开应用后能看到摄像头实时画面，AI 能理解镜头内容 | ✅ | ⬜ | 摄像头预览正常，帧发送到千问并收到视觉描述 |
| US2 | 对着麦克风说话，AI 听懂并给予语音+文字回复 | ✅ | ⬜ | VAD 截取语音段→千问 ASR→生成回复→Edge TTS 播放 |
| US3 | 画面变化时问"这是什么"，AI 结合画面内容回答 | ✅ | ⬜ | 关键帧随音频发送，千问返回结合视觉的回复 |

#### 🟡 P1 — 体验提升

| # | 用户故事 | 计划 | 实际 | 验收标准 |
|---|---------|:--:|:--:|---------|
| US4 | 不说话/画面不变时不消耗 API 调用 | ✅ | ⬜ | VAD 过滤静音，dhash 过滤重复帧，控制台查看节省统计 |
| US5 | AI 记得刚才聊过什么，对话有连续性 | ✅ | ⬜ | 上下文窗口保留最近 10 轮，SQLite 持久化 |
| US6 | 从说完话到 AI 开始回复延迟 < 3 秒 | ✅ | ⬜ | 语音段结束→千问→TTS 首音延迟 < 3 秒 |

#### 🔵 P2 — 场景覆盖

| # | 用户故事 | 计划 | 实际 | 验收标准 |
|---|---------|:--:|:--:|---------|
| US7 | 无障碍模式：AI 主动描述周围环境变化 | ✅ | ⬜ | 连续模式开关，每 N 秒检查画面变化并播报 |
| US8 | 可自由选择语音或文字输入，不强制麦克风 | ✅ | ⬜ | TextInput 组件可用，回车发送，走 DeepSeek 纯文字 |
| US9 | 查看对话历史记录并支持搜索 | ✅ | ⬜ | HistoryPanel 列表 + 关键词搜索，点击回放 |

#### ⚪ P3 — 扩展功能（选做）

| # | 用户故事 | 计划 | 实际 | 验收标准 |
|---|---------|:--:|:--:|---------|
| US10 | 设置中切换 TTS 音色和语速 | 🔲 | ⬜ | SettingsPanel 提供音色选择 + 语速滑块 |
| US11 | 应用记住偏好设置 | 🔲 | ⬜ | PreferenceStore 持久化，启动自动加载 |

> 图例：✅ 计划实现  🔲 选做  ⬜ 未开始  🟡 开发中  ✅ 已实现

### 6.2 无障碍模式详细设计 (US7)

无障碍模式是 P2 中的核心差异化功能：

- **触发方式**：UI 开关或快捷键 (Ctrl+Shift+A)
- **工作模式**：每 5 秒检查一次画面变化
  - 画面变化（dhash 汉明距离 > 10）→ 调用千问 Omni 进行场景描述
  - 画面不变 → 跳过，不调用 API
  - 每 60 秒强制刷新一次（防止遗漏细微变化）
- **播报方式**：Edge TTS 语音播报 + 文字气泡
- **成本优化**：帧去重在此模式下效果最显著（节省 50-80%）

---

## 7. 成本控制策略

### 7.1 五层省钱架构

#### L1 — 发送前拦截（本地零成本）

| 技术 | 机制 | 预期节省 |
|------|------|---------|
| VAD 静音检测 | RMS 实时计算，-40 dBFS 阈值，静音不发送 | 节省 60-70% 音频 API 调用 |
| dhash 帧去重 | 感知哈希 + 汉明距离 ≤ 5 视为重复，重复不发送 | 节省 50-80% 视觉 API 调用 |
| 抽帧 2fps | 对话场景 2fps 足够，vs 摄像头原始 30fps | 帧数减少 93% |

#### L2 — 模型路由（按需选低价模型）

| 路由规则 | 使用模型 | 成本对比 |
|----------|---------|---------|
| 纯文字对话 | DeepSeek V4 | ~0.5 元/百万 token |
| 视觉+语音 | 千问 Omni | ~1.5 元/百万 token (视觉) |
| TTS 合成 | Edge TTS 本地 | 完全免费 |

#### L3 — 上下文压缩（减少每次调用 token 数）

| 策略 | 实现 |
|------|------|
| 帧分辨率控制 | 640×480，JPEG Q75%，约 90 token/帧（千问） |
| 旧消息摘要 | 超过 10 轮后，将早期对话压缩为 200 字摘要 |
| 图片质量平衡 | Q75% 文件大小减半，视觉理解精度几乎无损 |

#### L4 — 本地缓存（相同输入不重复调用）

| 策略 | 实现 |
|------|------|
| 帧特征缓存 | 同一场景停留（连续 3+ 帧相似），复用上次视觉描述 |
| 高频问题模板 | "这是什么"等高频提问的 prompt 模板本地预优化 |

#### L5 — 用量监控与预警

| 功能 | 实现 |
|------|------|
| 实时用量统计 | 每次 API 调用记录 token 数，累计今日费用 |
| 预算上限 | 用户可设日/月预算上限，超出弹窗确认 |
| 节省报告 | 展示 VAD/去重/缓存各层节省的调用次数和金额 |

### 7.2 预估日成本

| 场景 | 日对话轮数 | 含图轮次 | 优化前/天 | 优化后/天 |
|------|----------|---------|----------|----------|
| 轻度使用 | 30 轮 | 10 次 | ~¥0.50 | **~¥0.10** |
| 中度使用 | 100 轮 | 30 次 | ~¥1.50 | **~¥0.35** |
| 重度使用 | 300 轮 | 80 次 | ~¥4.50 | **~¥1.00** |
| 无障碍连续模式 | 持续运行 | 每 10s | ~¥15.00 | **~¥3.00** |

### 7.3 计划采用 vs 实际采用（待跟踪）

| 策略 | 计划 | 实际 | 效果 |
|------|:--:|:--:|------|
| L1 VAD 静音检测 | ✅ | ⬜ | — |
| L1 dhash 帧去重 | ✅ | ⬜ | — |
| L1 抽帧 2fps | ✅ | ⬜ | — |
| L2 模型路由 (千问/DeepSeek) | ✅ | ⬜ | — |
| L2 Edge TTS 本地免费 | ✅ | ⬜ | — |
| L3 帧分辨率限制 | ✅ | ⬜ | — |
| L3 旧消息摘要压缩 | ✅ | ⬜ | — |
| L4 帧特征缓存 | ✅ | ⬜ | — |
| L5 用量监控 + 预算预警 | ✅ | ⬜ | — |
| L5 节省报告 | ✅ | ⬜ | — |

---

## 8. 数据流与状态管理

### 8.1 对话状态机

```
IDLE ──(用户开始说话)──▶ LISTENING
                             │
                    (VAD 检测到 1.5s 静音)
                             │
                             ▼
                         PROCESSING ──(API 返回)──▶ SPEAKING
                             │                        │
                             │                   (TTS 播放完毕)
                             │                        │
                             └────────────────────────┘
                                       │
                                       ▼
                                     IDLE
```

### 8.2 IPC 接口定义

```typescript
// preload/index.ts — 暴露给渲染进程的安全 API
interface ElectronAPI {
  // 媒体控制
  startCamera(): Promise<MediaStream>;
  stopCamera(): Promise<void>;
  
  // 对话
  sendMessage(text: string, includeFrame: boolean): Promise<void>;
  toggleAccessibilityMode(enabled: boolean): Promise<void>;
  
  // 状态订阅
  onStateChange(callback: (state: AppState) => void): void;
  onTranscript(callback: (text: string) => void): void;
  onResponse(callback: (response: AIResponse) => void): void;
  onCostUpdate(callback: (cost: CostSummary) => void): void;
  
  // 历史
  getHistory(query?: string): Promise<ConversationTurn[]>;
  
  // 设置
  getPreferences(): Promise<UserPreferences>;
  setPreferences(prefs: Partial<UserPreferences>): Promise<void>;
}
```

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 千问 Omni API 不稳定 | 核心功能不可用 | DeepSeek + 本地 ASR 降级方案 |
| API 成本超出预期 | 用户流失 | L5 预算预警 + 节省报告让用户感知价值 |
| Electron 打包体积大 | 下载体验差 | 按需加载，TTS 用系统内置 |
| 实时延迟过高 | 对话不自然 | 流式输出、VAD 参数调优、预加载 |
| macOS/Windows 兼容性 | 部分用户不可用 | 优先 Windows，macOS 适配作为 P3 |

---

## 10. 审阅记录

| 日期 | 审阅者 | 备注 |
|------|--------|------|
| 2026-06-12 | AI 生成 | 初稿，待用户审阅 |
| — | — | — |

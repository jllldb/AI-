# AI 视觉对话助手

> 🎥 桌面端 AI 多模态对话应用 — 打开摄像头和麦克风，AI 看得见、听得懂、会回应。

[![Electron](https://img.shields.io/badge/Electron-33-47848f?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📷 **视觉理解** | 摄像头实时画面 AI 分析，支持物体识别、场景描述、文字识别 |
| 🎙️ **语音对话** | VAD 自动检测说话，支持连续多轮语音交互 |
| 🤖 **多供应商** | 千问 / DeepSeek / OpenAI / Gemini / Claude — 任选或自动 |
| 🔊 **语音合成** | Edge TTS 本地免费语音输出，多种音色可选 |
| ♿ **无障碍模式** | 自动检测画面变化并语音播报周围环境 |
| 💰 **智能省钱** | 五层成本控制：静音过滤 · 帧去重 · 模型路由 · 上下文压缩 · 用量监控 |
| 🔒 **隐私优先** | API Key 仅存本地 SQLite，不上传不共享 |

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- 摄像头 + 麦克风（可选，纯文字对话不需要）
- 至少一个 AI 供应商的 API Key

### 安装

```bash
git clone https://github.com/jllldb/AI-.git
cd AI-
npm install
```

### 配置

启动应用 → 点击 ⚙️ 设置 → 填入任意一个供应商的 API Key → 保存

| 供应商 | 获取 Key | 特点 |
|--------|---------|------|
| 阿里云 千问 | [dashscope.aliyun.com](https://dashscope.aliyun.com) | 国产首选，图文理解强 |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | 极致性价比 |
| OpenAI | [platform.openai.com](https://platform.openai.com) | 多模态标杆 |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com) | 1M 超长上下文 |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) | 深度推理 |

### 启动

```bash
npm run dev        # 开发模式（Vite + Electron）
npm run build      # 生产构建
npm run package    # 打包为安装程序 (Windows)
```

## 🏗️ 技术架构

```
┌─────────────────────────────────────────┐
│  Renderer (React 18 + Tailwind)         │
│  CameraPreview · ChatBubble · Settings  │
├─────────────────────────────────────────┤
│  Preload (contextBridge)                │
├─────────────────────────────────────────┤
│  Main Process (Electron 33)             │
│  ┌──────────────────────────────────┐   │
│  │ MediaService  ·  VADService      │   │
│  │ FrameDedup    ·  TTSService      │   │
│  │ ContextManager · ModelRouter     │   │
│  │ Qwen · DeepSeek · OpenAI ·       │   │
│  │ Gemini · Claude  Clients         │   │
│  │ SQLite (better-sqlite3)          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 📁 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── clients/             # API 客户端（5 个供应商）
│   ├── router/              # 模型路由决策
│   ├── services/            # 媒体/VAD/TTS/上下文/对话管理
│   └── store/               # SQLite 持久化
├── preload/                 # contextBridge 安全桥接
├── renderer/                # React 渲染进程
│   ├── components/          # UI 组件
│   └── hooks/               # React Hooks
└── shared/                  # 共享类型和常量
```

## 🔒 隐私说明

- **API Key** — 仅存储在本地 SQLite 数据库（`%APPDATA%/ai-visual-assistant/`）
- **摄像头/麦克风** — 仅在本地处理，仅关键帧发送到 AI API
- **对话历史** — 仅保存在本地，不上传任何服务器
- **零遥测** — 不收集任何使用数据

## 📄 License

MIT
演示视频网址
https://b23.tv/EPlFaSU

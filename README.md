# AI 视觉对话助手

> 桌面端 AI 视觉对话应用 — 打开摄像头和麦克风，AI 看得到、听得到、会回应。

## 功能

- 📷 **视觉理解** — 摄像头实时画面 AI 分析
- 🎙️ **语音对话** — 麦克风拾音，VAD 自动检测说话
- 🤖 **多模型支持** — 千问 Qwen VL / DeepSeek，可切换
- 🔊 **语音合成** — Edge TTS 本地免费语音输出
- ♿ **无障碍模式** — 自动描述环境变化
- 💰 **成本控制** — 五层省钱：静音过滤、帧去重、模型路由、上下文压缩、用量监控

## 快速开始

### 1. 安装

```bash
git clone <your-repo-url>
cd ai-visual-assistant
npm install
```

### 2. 配置 API Key

启动应用 → 点击 ⚙️ 设置 → 填入 API Key → 保存并应用

- **千问 API Key**：从 [dashscope.aliyun.com](https://dashscope.aliyun.com) 获取
- **DeepSeek API Key**（可选）：从 [platform.deepseek.com](https://platform.deepseek.com) 获取

> 🔒 你的 API Key **只保存在本地**，不会上传到任何服务器。

### 3. 启动

```bash
npm run dev      # 开发模式
npm run build    # 生产构建
npm run package  # 打包安装程序
```

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 构建 | Vite 6 |
| 持久化 | SQLite (better-sqlite3) |
| AI 模型 | 千问 Qwen VL / DeepSeek |
| 语音合成 | Edge TTS (本地免费) |

## 架构

```
Renderer (React) ←→ Preload (contextBridge) ←→ Main Process
                                                      ├── MediaService (摄像头/麦克风)
                                                      ├── VADService (静音检测)
                                                      ├── FrameDedup (帧去重)
                                                      ├── QwenClient / DeepSeekClient
                                                      ├── ModelRouter (混合路由)
                                                      ├── TTSService (Edge TTS)
                                                      └── SQLite (对话历史+偏好设置)
```

## 隐私

- 所有 API Key 仅存储在本地 SQLite 数据库
- 摄像头和麦克风数据仅在本地处理，仅关键帧发送到 AI API
- 对话历史仅保存在本地，不上传

## License

MIT

# 开发历程

> AI 视觉对话助手 — 从设计到交付的完整开发记录

---

## Phase 1: 需求分析与架构设计

**产出**：设计规格说明书 + 实现计划

- 确定 Electron 桌面应用 + React 前端方案
- 设计端云协同五层架构（表示层 / 本地端 / 网络层 / 云端 / 持久层）
- 选定千问 Qwen VL + DeepSeek 混合模型路由策略
- 制定 11 个用户故事（P0-P3 优先级）
- 设计五层成本控制策略（发送前拦截 / 模型路由 / 上下文压缩 / 本地缓存 / 用量监控）
- 输出完整技术方案文档（spec + plan）

---

## Phase 2: 项目脚手架 & 核心实现

**产出**：完整可运行的应用骨架

- Electron 33 + React 18 + TypeScript + Tailwind CSS + Vite 6
- 28 个源文件，主进程 / 渲染进程分离架构
- 媒体采集服务（摄像头抽帧 2fps + 麦克风 16kHz）
- VAD 静音检测（RMS 阈值 -40dBFS）
- dhash 帧去重（感知哈希 + 汉明距离）
- 千问 / DeepSeek API 客户端
- 模型路由决策引擎
- 上下文窗口管理（滑动窗口 + 摘要压缩）
- Edge TTS 本地语音合成
- SQLite 对话历史 + 偏好设置持久化
- IPC 通信桥（contextBridge + invoke/send）

---

## Phase 3: 端到端联调 & 关键 Bug 修复

**修复的问题**：

| 问题 | 根因 | 解决方案 |
|------|------|---------|
| 摄像头/麦克风无权限 | Electron 未注册 permission handler | 添加 `session.setPermissionRequestHandler` |
| 视频帧未送达 AI | IPC 帧数据未路由到 ConversationManager | 连接 `media:frame` → `conversationManager.handleFrame()` |
| API 调用全部静默失败 | 文字对话路由到 DeepSeek 但 Key 为空 | 无 DeepSeek Key 时自动回退千问 |
| `qwen-omni-turbo` 报错 | 该模型仅接受多模态输入 | 更换为 `qwen-vl-plus`（支持纯文字+图文） |
| preload 脚本崩溃 | sandbox 中 `require()` 无法解析相对路径 | IPC 通道常量内联到 preload，仅保留 `require('electron')` |
| 无法判断是否在对话 | 无语音识别反馈 | 添加音频电平条 + 实时 transcript 预览 |

---

## Phase 4: UI/UX 优化

- 设置面板重构：弹窗模式 + "保存并应用" 按钮 + 脏状态追踪
- 移除浮动面板，信息整合到状态栏
- 添加 🤖 模型供应商指示器
- 音频电平条紧凑化，仅在录音时显示
- 对话空状态引导提示
- HTML 层 preload 诊断条（独立于 React，验证 electronAPI 连接状态）

---

## Phase 5: 多供应商扩展

**新增支持**：OpenAI (GPT-4o) / Google Gemini / Anthropic Claude

- 五大供应商 API 客户端（均支持文字 + 视觉）
- 设置面板供应商卡片 UI（显示 Key 状态 + 获取链接）
- 模型路由支持 6 种模式（5 供应商 + 自动选择）
- 供应商对应模型可自定义

---

## Phase 6: 隐私保护 & 开源发布

- 移除所有硬编码 API Key
- 所有 Key 仅存储在本地 SQLite 数据库
- `.env.example` 提供参考，`.env` 加入 `.gitignore`
- README 重写（Badge、架构图、供应商表格、隐私说明）
- 推送至 GitHub 开源
- Git 提交者设置为项目作者

---

## 技术栈总览

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript 5 + Tailwind CSS 3 |
| 构建 | Vite 6 |
| 持久化 | SQLite (better-sqlite3) |
| AI 供应商 | 千问 / DeepSeek / OpenAI / Gemini / Claude |
| 语音合成 | Edge TTS (本地免费) |
| 语音检测 | RMS VAD (自研) |
| 帧去重 | dhash + 汉明距离 (自研) |

## 用户故事覆盖

| 优先级 | 数量 | 状态 |
|--------|:--:|:--:|
| 🟢 P0 核心闭环 | 3 | ✅ |
| 🟡 P1 体验提升 | 3 | ✅ |
| 🔵 P2 场景覆盖 | 3 | ✅ |
| ⚪ P3 扩展功能 | 2 | 🔲 |

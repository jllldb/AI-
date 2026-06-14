import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIpcHandlers } from './ipc-handlers';
import { preferenceStore } from './store/preference-store';
import { initQwenClient } from './clients/qwen-client';
import { initDeepSeekClient } from './clients/deepseek-client';
import { initOpenAIClient } from './clients/openai-client';
import { initGeminiClient } from './clients/gemini-client';
import { initClaudeClient } from './clients/claude-client';
import { initOllamaClient } from './clients/ollama-client';

let mainWindow: BrowserWindow | null = null;

async function findVitePort(start = 5173, maxAttempts = 10): Promise<number> {
  for (let port = start; port < start + maxAttempts; port++) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 404) return port;
      // status 200 = page loaded, 404 = vite running but path not found
    } catch { /* port not open */ }
  }
  return start; // fallback
}

async function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  console.log('[Main] Preload path:', preloadPath);
  console.log('[Main] Preload exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      sandbox: false,
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AI 视觉对话助手',
  });

  // Detect preload load failure
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.executeJavaScript(`
      if (typeof window.electronAPI === 'undefined') {
        document.body.insertAdjacentHTML('beforeend',
          '<div style="position:fixed;top:30px;left:0;right:0;z-index:99999;padding:10px;background:red;color:#fff;text-align:center;font-size:14px;">' +
          '❌ electronAPI 未加载！preload 脚本执行失败。<br>' +
          '可能原因: 杀毒软件拦截 / 文件损坏 / 沙箱限制<br>' +
          '请查看控制台 (Ctrl+Shift+I) 的 Console 面板' +
          '</div>');
      }
    `);
  });

  // Log preload console messages to main process
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.startsWith('[Preload]')) {
      console.log(message);
    }
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const port = await findVitePort();
    console.log('[Main] Loading from Vite port:', port);
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // Init
  preferenceStore.init();
  const prefs = preferenceStore.getAll();
  initQwenClient(prefs.qwenApiKey || '');
  initDeepSeekClient(prefs.deepseekApiKey || '');
  initOpenAIClient(prefs.openaiApiKey || '');
  initGeminiClient(prefs.geminiApiKey || '');
  initClaudeClient(prefs.claudeApiKey || '');
  initOllamaClient();
  registerIpcHandlers(mainWindow);

  // Start conversation manager
  const { conversationManager } = require('./services/conversation-manager');
  conversationManager.init();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

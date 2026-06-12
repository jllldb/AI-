import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { preferenceStore } from './store/preference-store';
import { initQwenClient } from './clients/qwen-client';
import { initDeepSeekClient } from './clients/deepseek-client';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AI 视觉对话助手',
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
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
  registerIpcHandlers(mainWindow);

  // Start conversation manager
  const { conversationManager } = require('./services/conversation-manager');
  conversationManager.init();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

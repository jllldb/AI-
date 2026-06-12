import { app, BrowserWindow } from 'electron';
import path from 'path';
import { buildContainer } from './di/container';
import { TYPES } from './core/tokens';
import { registerIpcHandlers } from './ipc/handlers';
import type { IPreferenceStore, IIpcEmitter } from './core/interfaces';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // 1. Build DI container (composition root)
  const container = buildContainer();

  // 2. Init persistence
  const prefs = container.resolve<IPreferenceStore>(TYPES.PreferenceStore);
  prefs.init();

  // 3. Create window
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

  // 4. Wire IPC emitter to window
  const emitter = container.resolve<IIpcEmitter>(TYPES.IpcEmitter);
  emitter.setWindow(mainWindow);

  // 5. Register IPC handlers
  registerIpcHandlers(mainWindow, container);

  // 6. Load page
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

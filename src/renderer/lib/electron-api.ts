import type { ElectronAPI } from '../types/electron';

export function getApi(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('electronAPI not available — are you running inside Electron?');
  }
  return window.electronAPI;
}

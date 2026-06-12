import { BrowserWindow } from 'electron';

export interface MediaCallbacks {
  onFrame: (jpegBase64: string) => void;
  onAudioChunk: (audioBuffer: Float32Array) => void;
  onError: (error: Error) => void;
}

export class MediaService {
  private callbacks: MediaCallbacks | null = null;
  private isCapturing = false;

  async startCapture(mainWindow: BrowserWindow): Promise<void> {
    await mainWindow.webContents.executeJavaScript(
      'window.__startMediaCapture(640, 480, 0.75);'
    );
    this.isCapturing = true;
  }

  setCallbacks(cb: MediaCallbacks) { this.callbacks = cb; }

  stopCapture(mainWindow: BrowserWindow) {
    this.isCapturing = false;
    mainWindow.webContents.executeJavaScript('window.__stopMediaCapture()');
  }

  handleFrame(jpegBase64: string) {
    if (!this.isCapturing) return;
    this.callbacks?.onFrame(jpegBase64);
  }

  handleAudioChunk(audioData: number[]) {
    if (!this.isCapturing) return;
    this.callbacks?.onAudioChunk(new Float32Array(audioData));
  }
}

export const mediaService = new MediaService();

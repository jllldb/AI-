import React from 'react';
import type { MediaError } from '../hooks/useMediaStream';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  error?: MediaError | null;
}

export const CameraPreview: React.FC<Props> = ({ videoRef, isActive, error }) => (
  <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

    {/* Error overlay */}
    {error && (
      <div className="absolute inset-0 flex items-center justify-center bg-red-900/80">
        <div className="text-center px-6">
          <p className="text-red-300 text-2xl mb-2">⚠️</p>
          <p className="text-white text-sm font-medium mb-1">
            {error.type === 'camera' ? '摄像头错误' :
             error.type === 'microphone' ? '麦克风错误' : '媒体设备错误'}
          </p>
          <p className="text-red-200 text-xs">{error.message}</p>
        </div>
      </div>
    )}

    {/* Inactive overlay */}
    {!isActive && !error && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <p className="text-white text-lg">点击麦克风按钮开始</p>
      </div>
    )}

    {/* Status indicator */}
    <div className="absolute top-2 right-2 flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${
        error ? 'bg-red-500' : isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
      }`} />
      <span className="text-white text-xs">
        {error ? '错误' : isActive ? '采集中' : '待机'}
      </span>
    </div>
  </div>
);

import React from 'react';
import type { MediaError } from '../hooks/useMediaStream';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  error?: MediaError | null;
}

export const CameraPreview: React.FC<Props> = ({ videoRef, isActive, error }) => (
  <div className="relative bg-gray-900 rounded-xl overflow-hidden w-full h-full shadow-inner">
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover"
    />

    {/* Error state */}
    {error && (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-white text-sm font-medium mb-1">
            {error.type === 'camera' ? '摄像头不可用' :
             error.type === 'microphone' ? '麦克风不可用' : '媒体设备不可用'}
          </p>
          <p className="text-gray-400 text-xs">{error.message}</p>
          <p className="text-gray-500 text-[10px] mt-3">请检查设备连接并在系统设置中授权</p>
        </div>
      </div>
    )}

    {/* Idle state */}
    {!isActive && !error && (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-white text-sm font-medium">摄像头待机中</p>
          <p className="text-gray-400 text-xs mt-1">点击下方按钮开始对话</p>
        </div>
      </div>
    )}

    {/* Status dot — top right */}
    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur rounded-full px-2.5 py-1">
      <span className={`w-2 h-2 rounded-full ${
        error ? 'bg-red-400' : isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
      }`} />
      <span className="text-white text-[10px] font-medium">
        {error ? '错误' : isActive ? 'LIVE' : '待机'}
      </span>
    </div>

    {/* Brand watermark */}
    {isActive && (
      <div className="absolute bottom-3 left-3 text-white/30 text-[10px] font-mono">
        AI 视觉助手
      </div>
    )}
  </div>
);

import React from 'react';
export const CameraPreview: React.FC<{ videoRef: React.RefObject<HTMLVideoElement>; isActive: boolean }> = ({ videoRef, isActive }) => (
  <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
    {!isActive && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><p className="text-white text-lg">摄像头未启动</p></div>}
    <div className="absolute top-2 right-2 flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
      <span className="text-white text-xs">{isActive ? '采集中' : '待机'}</span>
    </div>
  </div>
);

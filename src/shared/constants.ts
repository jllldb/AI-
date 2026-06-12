export const MEDIA = {
  FRAME_RATE: 2,
  FRAME_WIDTH: 640,
  FRAME_HEIGHT: 480,
  JPEG_QUALITY: 0.75,
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHANNELS: 1,
} as const;

export const VAD = {
  SILENCE_THRESHOLD_DBFS: -40,
  SILENCE_TIMEOUT_MS: 1500,
  MIN_SPEECH_DURATION_MS: 300,
} as const;

export const DEDUP = {
  HAMMING_THRESHOLD: 5,
  ACCESSIBILITY_DIFF: 10,
} as const;

export const CONTEXT = {
  MAX_RECENT_TURNS: 10,
  SUMMARY_MAX_CHARS: 200,
} as const;

export const ACCESSIBILITY = {
  CHECK_INTERVAL_MS: 5000,
  FORCE_REFRESH_INTERVAL_MS: 60000,
} as const;

export const COST = {
  QWEN_PRICE_PER_1K_TOKENS: 0.0015,
  DEEPSEEK_PRICE_PER_1K_TOKENS: 0.0005,
  DEFAULT_DAILY_BUDGET: 5,
} as const;

export const IPC_CHANNELS = {
  MEDIA_START_CAMERA: 'media:start-camera',
  MEDIA_STOP_CAMERA: 'media:stop-camera',
  CONVERSATION_SEND_MESSAGE: 'conversation:send-message',
  CONVERSATION_TOGGLE_ACCESSIBILITY: 'conversation:toggle-accessibility',
  STATE_CHANGED: 'state:changed',
  TRANSCRIPT_UPDATE: 'transcript:update',
  RESPONSE_UPDATE: 'response:update',
  COST_UPDATE: 'cost:update',
  HISTORY_GET: 'history:get',
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',
} as const;

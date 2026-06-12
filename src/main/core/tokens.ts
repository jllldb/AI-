export const TYPES = {
  // Stores
  PreferenceStore: Symbol.for('PreferenceStore'),
  ConversationStore: Symbol.for('ConversationStore'),

  // Services
  VADService: Symbol.for('VADService'),
  FrameDedup: Symbol.for('FrameDedup'),
  ContextManager: Symbol.for('ContextManager'),
  TTSService: Symbol.for('TTSService'),
  CostTracker: Symbol.for('CostTracker'),
  ModelRouter: Symbol.for('ModelRouter'),

  // Orchestrator
  ConversationOrchestrator: Symbol.for('ConversationOrchestrator'),

  // IPC
  IpcEmitter: Symbol.for('IpcEmitter'),

  // Provider Factory
  ProviderFactory: Symbol.for('ProviderFactory'),
} as const;

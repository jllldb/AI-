import { TYPES } from '../core/tokens';
import type {
  IVADService, IFrameDedup, IContextManager, ITTSService,
  ICostTracker, IModelRouter, IConversationOrchestrator,
  IConversationStore, IPreferenceStore, IIpcEmitter,
} from '../core/interfaces';

// ============ Lightweight DI Container ============

type Factory<T> = (container: Container) => T;

export class Container {
  private factories = new Map<symbol, Factory<unknown>>();
  private instances = new Map<symbol, unknown>();

  register<T>(token: symbol, factory: Factory<T>): void {
    this.factories.set(token, factory as Factory<unknown>);
  }

  resolve<T>(token: symbol): T {
    if (!this.instances.has(token)) {
      const factory = this.factories.get(token);
      if (!factory) throw new Error(`[DI] No registration for ${String(token)}`);
      this.instances.set(token, factory(this));
    }
    return this.instances.get(token) as T;
  }

  /** Replace an existing registration (used for hot-reload of API keys) */
  rebind<T>(token: symbol, instance: T): void {
    this.instances.set(token, instance);
  }

  reset(): void {
    this.instances.clear();
  }
}

// ============ Composition Root ============
// Lazy imports to avoid circular dependencies at module load time

export function buildContainer(): Container {
  const c = new Container();

  // ---- Stores (no dependencies) ----
  c.register(TYPES.PreferenceStore, () => {
    const { PreferenceStore } = require('../store/preference-store');
    return new PreferenceStore();
  });
  c.register(TYPES.ConversationStore, () => {
    const { ConversationStore } = require('../store/conversation-store');
    return new ConversationStore();
  });

  // ---- Services ----
  c.register(TYPES.VADService, () => {
    const { VADService } = require('../services/vad-service');
    return new VADService();
  });
  c.register(TYPES.FrameDedup, () => {
    const { FrameDedup } = require('../services/frame-dedup');
    return new FrameDedup();
  });
  c.register(TYPES.ContextManager, () => {
    const { ContextManager } = require('../services/context-manager');
    return new ContextManager(c.resolve<IConversationStore>(TYPES.ConversationStore));
  });
  c.register(TYPES.TTSService, () => {
    const { TTSService } = require('../services/tts-service');
    return new TTSService();
  });
  c.register(TYPES.CostTracker, () => {
    const { CostTracker } = require('../services/cost-tracker');
    const prefs = c.resolve<IPreferenceStore>(TYPES.PreferenceStore);
    return new CostTracker(prefs);
  });
  c.register(TYPES.ModelRouter, () => {
    const { ModelRouter } = require('../router/model-router');
    return new ModelRouter();
  });

  // ---- Provider Factory ----
  c.register(TYPES.ProviderFactory, () => {
    const { AIProviderFactory } = require('../clients/provider-factory');
    const prefs = c.resolve<IPreferenceStore>(TYPES.PreferenceStore);
    const factory = new AIProviderFactory(prefs);
    factory.initFromPreferences();
    return factory;
  });

  // ---- IPC Emitter ----
  c.register(TYPES.IpcEmitter, () => {
    const { IpcEmitter } = require('../ipc/emitter');
    return new IpcEmitter();
  });

  // ---- Orchestrator (many deps) ----
  c.register(TYPES.ConversationOrchestrator, () => {
    const { ConversationOrchestrator } = require('../services/conversation-orchestrator');
    const prefs = c.resolve<IPreferenceStore>(TYPES.PreferenceStore);
    return new ConversationOrchestrator({
      vadService: c.resolve<IVADService>(TYPES.VADService),
      frameDedup: c.resolve<IFrameDedup>(TYPES.FrameDedup),
      contextManager: c.resolve<IContextManager>(TYPES.ContextManager),
      modelRouter: c.resolve<IModelRouter>(TYPES.ModelRouter),
      ttsService: c.resolve<ITTSService>(TYPES.TTSService),
      costTracker: c.resolve<ICostTracker>(TYPES.CostTracker),
      ipcEmitter: c.resolve<IIpcEmitter>(TYPES.IpcEmitter),
      preferenceStore: prefs,
      providerFactory: c.resolve(TYPES.ProviderFactory),
    });
  });

  return c;
}

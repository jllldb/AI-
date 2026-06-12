import type { AIResponse, ConversationInput, ModelChoice } from '../../shared/types';
import type {
  IVADService, IFrameDedup, IContextManager, ITTSService,
  ICostTracker, IModelRouter, IPreferenceStore, IIpcEmitter,
} from '../core/interfaces';

export interface OrchestratorDeps {
  vadService: IVADService;
  frameDedup: IFrameDedup;
  contextManager: IContextManager;
  modelRouter: IModelRouter;
  ttsService: ITTSService;
  costTracker: ICostTracker;
  ipcEmitter: IIpcEmitter;
  preferenceStore: IPreferenceStore;
  providerFactory: { get(name: ModelChoice): { chatWithVision(params: any): Promise<any>; chat(messages: any[]): Promise<any>; describeImage(img: string, prompt?: string): Promise<any> } };
}

export class ConversationOrchestrator {
  private lastFrameBase64: string | null = null;
  private lastFrameDhash: bigint | null = null;
  private isAccessibilityMode = false;
  private accessibilityTimer: ReturnType<typeof setInterval> | null = null;
  private lastFrameSentTime = 0;
  private hasDeepSeekKey = false;
  private speechStartTime = 0;
  private modelProvider = 'qwen';

  constructor(private d: OrchestratorDeps) {
    const prefs = this.d.preferenceStore.getAll();
    this.modelProvider = prefs.modelProvider || 'qwen';
    this.hasDeepSeekKey = !!(prefs.deepseekApiKey && prefs.deepseekApiKey.trim());

    this.d.vadService.setCallbacks({
      onSpeechStart: () => this.onSpeechStart(),
      onSpeechEnd: (segments) => this.handleSpeechEnd(segments),
    });
  }

  private onSpeechStart(): void {
    this.speechStartTime = Date.now();
    this.d.ipcEmitter.emitState('listening');
    this.d.ipcEmitter.emitTranscript('🎤 正在听...');
  }

  handleFrame(jpegBase64: string, dhashHex: string): void {
    this.lastFrameBase64 = jpegBase64;
    this.lastFrameDhash = BigInt('0x' + dhashHex);
  }

  private async handleSpeechEnd(segments: Float32Array[]): Promise<void> {
    this.d.ipcEmitter.emitState('processing');
    const speechDuration = ((Date.now() - this.speechStartTime) / 1000).toFixed(1);

    const merged = this.d.vadService.mergeSegments(segments);
    const wavBuffer = this.d.vadService.float32ToWav(merged, 16000);
    const audioBase64 = wavBuffer.toString('base64');

    let frameToSend: string | undefined;
    if (this.lastFrameDhash) {
      const isDup = this.d.frameDedup.isDuplicate(this.lastFrameDhash);
      if (!isDup && this.lastFrameBase64) {
        frameToSend = this.lastFrameBase64;
        this.lastFrameSentTime = Date.now();
      } else {
        this.d.costTracker.incrementSavedByDedup();
        if (this.d.frameDedup.getCachedDescription()) {
          this.d.costTracker.incrementSavedByCache();
        }
      }
    }

    const input: ConversationInput = {
      hasNewImage: !!frameToSend, hasSpeech: true, hasTextInput: false,
      isAccessibilityMode: this.isAccessibilityMode, isFollowUp: false,
    };
    const modelChoice = this.d.modelRouter.route(input, this.hasDeepSeekKey, this.modelProvider);

    const userContent = `🎤 语音输入 (${speechDuration}s)`;
    this.d.ipcEmitter.emitTranscript(userContent);

    try {
      let response: AIResponse;
      if (modelChoice === 'qwen') {
        const context = this.d.contextManager.getContext();
        const provider = this.d.providerFactory.get('qwen');
        const qr = await provider.chatWithVision({
          imageBase64: frameToSend, audioBase64,
          contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
        });
        const transcription = qr.transcription || userContent;
        this.d.ipcEmitter.emitTranscript(transcription);
        response = {
          text: qr.text || qr.responseText || '',
          visualDescription: qr.visualDescription,
          modelUsed: 'qwen', tokensUsed: qr.tokensUsed,
        };
        if (qr.visualDescription) this.d.frameDedup.cacheDescription(qr.visualDescription);
      } else {
        const context = this.d.contextManager.getContext();
        const messages = this.d.contextManager.buildMessages(context, '');
        const provider = this.d.providerFactory.get(modelChoice);
        const dr = await provider.chat(messages);
        response = { text: dr.text, modelUsed: modelChoice, tokensUsed: dr.tokensUsed };
      }

      this.d.ipcEmitter.emitResponse(response);
      this.d.ipcEmitter.emitState('speaking');

      try { await this.d.ttsService.synthesizeToBase64(response.text); } catch { /* TTS optional */ }

      this.d.contextManager.addTurn({
        role: 'user', content: userContent, modelUsed: modelChoice, tokensUsed: 0,
      });
      this.d.contextManager.addTurn({
        role: 'assistant', content: response.text,
        visualDescription: response.visualDescription,
        modelUsed: modelChoice, tokensUsed: response.tokensUsed,
      });

      this.d.costTracker.recordUsage(response.tokensUsed, modelChoice);
      this.d.ipcEmitter.emitCost(this.d.costTracker.summary);
      this.d.ipcEmitter.emitState('idle');
    } catch (error) {
      console.error('Conv error:', error);
      this.d.ipcEmitter.emitTranscript('❌ 识别失败，请重试');
      this.d.ipcEmitter.emitState('idle');
    }
  }

  async handleTextInput(text: string, includeFrame: boolean): Promise<AIResponse> {
    this.d.ipcEmitter.emitState('processing');
    const frameToSend = includeFrame ? this.lastFrameBase64 ?? undefined : undefined;

    const input: ConversationInput = {
      hasNewImage: !!frameToSend, hasSpeech: false, hasTextInput: true,
      isAccessibilityMode: false, isFollowUp: true,
    };
    const modelChoice = this.d.modelRouter.route(input, this.hasDeepSeekKey, this.modelProvider);

    let response: AIResponse;
    try {
      if (modelChoice === 'qwen') {
        const context = this.d.contextManager.getContext();
        const provider = this.d.providerFactory.get('qwen');
        const qr = await provider.chatWithVision({
          imageBase64: frameToSend, text,
          contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
        });
        response = {
          text: qr.text || qr.responseText || '',
          visualDescription: qr.visualDescription,
          modelUsed: 'qwen', tokensUsed: qr.tokensUsed,
        };
        if (qr.visualDescription) this.d.frameDedup.cacheDescription(qr.visualDescription);
      } else {
        const context = this.d.contextManager.getContext();
        const messages = this.d.contextManager.buildMessages(context, text);
        const provider = this.d.providerFactory.get(modelChoice);
        const dr = await provider.chat(messages);
        response = { text: dr.text, modelUsed: modelChoice, tokensUsed: dr.tokensUsed };
      }
    } catch (err: any) {
      console.error('[Conv] API error:', err.message);
      response = { text: '抱歉，AI 服务暂时不可用：' + (err.message || '未知错误'), modelUsed: modelChoice, tokensUsed: 0 };
    }

    this.d.ipcEmitter.emitResponse(response);
    this.d.ipcEmitter.emitState('speaking');
    try { await this.d.ttsService.synthesizeToBase64(response.text); } catch { /* TTS optional */ }

    this.d.contextManager.addTurn({ role: 'user', content: text, modelUsed: modelChoice, tokensUsed: 0 });
    this.d.contextManager.addTurn({
      role: 'assistant', content: response.text,
      visualDescription: response.visualDescription,
      modelUsed: modelChoice, tokensUsed: response.tokensUsed,
    });
    this.d.costTracker.recordUsage(response.tokensUsed, modelChoice);
    this.d.ipcEmitter.emitCost(this.d.costTracker.summary);
    this.d.ipcEmitter.emitState('idle');
    return response;
  }

  toggleAccessibility(enabled: boolean): void {
    this.isAccessibilityMode = enabled;
    if (enabled) {
      const interval = Number(this.d.preferenceStore.get('accessibilityInterval')) * 1000 || 5000;
      this.accessibilityTimer = setInterval(() => this.accessibilityTick(), interval);
    } else {
      if (this.accessibilityTimer) { clearInterval(this.accessibilityTimer); this.accessibilityTimer = null; }
    }
  }

  private async accessibilityTick(): Promise<void> {
    if (!this.lastFrameBase64 || !this.lastFrameDhash) return;
    const isSig = this.d.frameDedup.isSignificantChange(this.lastFrameDhash);
    const forceRefresh = (Date.now() - this.lastFrameSentTime) > 60000;
    if (!isSig && !forceRefresh) return;
    try {
      const provider = this.d.providerFactory.get('qwen');
      const { description, tokensUsed } = await provider.describeImage(this.lastFrameBase64);
      this.d.frameDedup.cacheDescription(description);
      this.lastFrameSentTime = Date.now();
      const resp: AIResponse = { text: description, visualDescription: description, modelUsed: 'qwen', tokensUsed };
      this.d.ipcEmitter.emitResponse(resp);
      this.d.ipcEmitter.emitState('speaking');
      try { await this.d.ttsService.synthesizeToBase64(description); } catch { /* TTS optional */ }
      this.d.contextManager.addTurn({
        role: 'system', content: '[场景] ' + description,
        visualDescription: description, modelUsed: 'qwen', tokensUsed,
      });
      this.d.costTracker.recordUsage(tokensUsed, 'qwen');
      this.d.ipcEmitter.emitCost(this.d.costTracker.summary);
      this.d.ipcEmitter.emitState('idle');
    } catch (e) { console.error('accessibility tick:', e); }
  }
}

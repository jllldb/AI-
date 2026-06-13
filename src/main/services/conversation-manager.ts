import { AIResponse, ConversationInput, ModelChoice, CostSummary, ModelProvider } from '../../shared/types';
import { vadService } from './vad-service';
import { frameDedup } from './frame-dedup';
import { contextManager } from './context-manager';
import { modelRouter } from '../router/model-router';
import { qwenClient } from '../clients/qwen-client';
import { deepseekClient } from '../clients/deepseek-client';
import { openaiClient } from '../clients/openai-client';
import { geminiClient } from '../clients/gemini-client';
import { claudeClient } from '../clients/claude-client';
import { ollamaClient } from '../clients/ollama-client';
import { ttsService } from './tts-service';
import { preferenceStore } from '../store/preference-store';
import { emitState, emitTranscript, emitResponse, emitCost } from '../ipc-handlers';
import { COST } from '../../shared/constants';

export class ConversationManager {
  private lastFrameBase64: string | null = null;
  private lastFrameDhash: bigint | null = null;
  private isAccessibilityMode = false;
  private accessibilityTimer: ReturnType<typeof setInterval> | null = null;
  private costSummary: CostSummary = {
    todayTokens: 0, todayCost: 0, dailyBudget: 5,
    callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0,
  };
  private lastFrameSentTime = 0;
  private speechStartTime = 0;
  private lastResponseTime = 0;
  private responseCooldownMs = 3000;
  private availableProviders: Set<ModelChoice> = new Set();
  private modelProvider: ModelProvider = 'auto';

  init() {
    this.reloadConfig();
    vadService.setCallbacks({
      onSpeechStart: () => {
        this.speechStartTime = Date.now();
        emitState('listening');
        emitTranscript('🎤 正在听...');
      },
      onSpeechEnd: (segments) => this.handleSpeechEnd(segments),
    });
  }

  handleFrame(jpegBase64: string, dhashHex: string) {
    this.lastFrameBase64 = jpegBase64;
    this.lastFrameDhash = BigInt('0x' + dhashHex);
  }

  private async handleSpeechEnd(segments: Float32Array[]) {
    // Cooldown gate: prevent rapid-fire responses
    const now = Date.now();
    if (now - this.lastResponseTime < this.responseCooldownMs) {
      console.log('[Conv] Cooldown active, ignoring speech');
      return;
    }

    emitState('processing');
    const speechDuration = ((now - this.speechStartTime) / 1000).toFixed(1);

    const merged = vadService.mergeSegments(segments);
    const wavBuffer = vadService.float32ToWav(merged, 16000);
    const audioBase64 = wavBuffer.toString('base64');

    let frameToSend: string | undefined;
    if (this.lastFrameDhash) {
      const isDup = frameDedup.isDuplicate(this.lastFrameDhash);
      if (!isDup && this.lastFrameBase64) {
        frameToSend = this.lastFrameBase64;
        this.lastFrameSentTime = Date.now();
      } else {
        this.costSummary.callsSavedByDedup++;
        if (frameDedup.getCachedDescription()) {
          this.costSummary.callsSavedByCache++;
        }
      }
    }

    const input: ConversationInput = {
      hasNewImage: !!frameToSend, hasSpeech: true, hasTextInput: false,
      isAccessibilityMode: this.isAccessibilityMode, isFollowUp: false,
    };
    const modelChoice = modelRouter.route(input, this.availableProviders, this.modelProvider);

    // Show user speech as a message immediately
    const userContent = `🎤 语音输入 (${speechDuration}s)`;
    emitTranscript(userContent);

    try {
      let response: AIResponse;
      // qwen-vl-plus does NOT support raw audio — send text prompt + image instead
      const speechPrompt = '用户正在对你说话（语音输入）。请根据摄像头画面内容，用中文自然地回应用户。如果画面中有值得注意的内容，可以主动提及。';

      if (modelChoice === 'qwen') {
        const context = contextManager.getContext();
        const qr = await qwenClient.multimodalChat({
          imageBase64: frameToSend,
          text: frameToSend ? speechPrompt : '用户正在对你说话。请用中文自然地回应。',
          contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
        });
        emitTranscript(userContent);

        response = {
          text: qr.responseText, visualDescription: qr.visualDescription,
          modelUsed: 'qwen', tokensUsed: qr.tokensUsed,
        };
        if (qr.visualDescription) frameDedup.cacheDescription(qr.visualDescription);
      } else {
        const context = contextManager.getContext();
        const messages = contextManager.buildMessages(context, '');
        const dr = await deepseekClient.chat(messages);
        response = { text: dr.text, modelUsed: 'deepseek', tokensUsed: dr.tokensUsed };
      }

      emitResponse(response);
      emitState('speaking');

      // TTS
      try {
        await ttsService.synthesizeToBase64(response.text);
      } catch { /* TTS optional */ }

      // Save history with actual transcription
      contextManager.addTurn({
        role: 'user', content: userContent, modelUsed: modelChoice, tokensUsed: 0,
      });
      contextManager.addTurn({
        role: 'assistant', content: response.text,
        visualDescription: response.visualDescription,
        modelUsed: modelChoice, tokensUsed: response.tokensUsed,
      });

      this.updateCost(response.tokensUsed, modelChoice);
      this.lastResponseTime = Date.now();  // Start cooldown
      emitState('idle');
    } catch (error: any) {
      console.error('[Conv] Speech error:', error.message);
      this.lastResponseTime = Date.now();  // Cooldown even on error — prevent loop!
      emitTranscript('❌ 识别失败: ' + (error.message || '未知错误'));
      emitState('idle');
    }
  }

  async handleTextInput(text: string, includeFrame: boolean): Promise<AIResponse> {
    emitState('processing');
    const frameToSend = includeFrame ? this.lastFrameBase64 ?? undefined : undefined;

    const input: ConversationInput = {
      hasNewImage: !!frameToSend, hasSpeech: false, hasTextInput: true,
      isAccessibilityMode: false, isFollowUp: true,
    };
    const modelChoice = modelRouter.route(input, this.availableProviders, this.modelProvider);

    let response: AIResponse;
    try {
      if (modelChoice === 'qwen') {
        // Qwen handles both multimodal and text-only
        const context = contextManager.getContext();
        const qr = await qwenClient.multimodalChat({
          imageBase64: frameToSend, text,
          contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
        });
        response = { text: qr.responseText, visualDescription: qr.visualDescription, modelUsed: 'qwen', tokensUsed: qr.tokensUsed };
        if (qr.visualDescription) frameDedup.cacheDescription(qr.visualDescription);
      } else {
        const context = contextManager.getContext();
        const messages = contextManager.buildMessages(context, text);
        const dr = await deepseekClient.chat(messages);
        response = { text: dr.text, modelUsed: 'deepseek', tokensUsed: dr.tokensUsed };
      }
    } catch (err: any) {
      console.error('[Conv] API error:', err.message);
      response = { text: '抱歉，AI 服务暂时不可用：' + (err.message || '未知错误'), modelUsed: modelChoice, tokensUsed: 0 };
    }

    emitResponse(response);
    emitState('speaking');
    try { await ttsService.synthesizeToBase64(response.text); } catch {}

    contextManager.addTurn({ role: 'user', content: text, modelUsed: modelChoice, tokensUsed: 0 });
    contextManager.addTurn({ role: 'assistant', content: response.text, visualDescription: response.visualDescription, modelUsed: modelChoice, tokensUsed: response.tokensUsed });
    this.updateCost(response.tokensUsed, modelChoice);
    emitState('idle');
    return response;
  }

  // Accessibility (US7)
  toggleAccessibility(enabled: boolean) {
    this.isAccessibilityMode = enabled;
    if (enabled) {
      const interval = Number(preferenceStore.get('accessibilityInterval')) * 1000 || 5000;
      this.accessibilityTimer = setInterval(() => this.accessibilityTick(), interval);
    } else {
      if (this.accessibilityTimer) { clearInterval(this.accessibilityTimer); this.accessibilityTimer = null; }
    }
  }

  private async accessibilityTick() {
    if (!this.lastFrameBase64 || !this.lastFrameDhash) return;
    // Cooldown gate
    if (Date.now() - this.lastResponseTime < this.responseCooldownMs) return;
    const isSig = frameDedup.isSignificantChange(this.lastFrameDhash);
    const forceRefresh = (Date.now() - this.lastFrameSentTime) > 60000;
    if (!isSig && !forceRefresh) return;
    try {
      const { description, tokensUsed } = await qwenClient.describeImage(this.lastFrameBase64);
      frameDedup.cacheDescription(description);
      this.lastFrameSentTime = Date.now();
      const resp: AIResponse = { text: description, visualDescription: description, modelUsed: 'qwen', tokensUsed };
      emitResponse(resp);
      emitState('speaking');
      try { await ttsService.synthesizeToBase64(description); } catch {}
      contextManager.addTurn({ role: 'system', content: '[场景] ' + description, visualDescription: description, modelUsed: 'qwen', tokensUsed });
      this.updateCost(tokensUsed, 'qwen');
      this.lastResponseTime = Date.now();  // Cooldown after accessibility too
      emitState('idle');
    } catch (e) { console.error('accessibility tick:', e); }
  }

  private updateCost(tokens: number, model: ModelChoice) {
    const price = model === 'qwen' ? COST.QWEN_PRICE_PER_1K_TOKENS : COST.DEEPSEEK_PRICE_PER_1K_TOKENS;
    this.costSummary.todayTokens += tokens;
    this.costSummary.todayCost += (tokens / 1000) * price;
    emitCost(this.costSummary);
  }

  getCostSummary(): CostSummary { return { ...this.costSummary }; }

  /** Unified AI call — routes to the correct client, auto-falls back on failure */
  private async callAI(model: ModelChoice, params: {
    text?: string;
    imageBase64?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<{ text: string; tokensUsed: number }> {
    // Try preferred model, fall back to any available provider
    const fallbacks = [...this.availableProviders].filter(p => p !== model);
    const tryOrder = [model, ...fallbacks];

    let lastError = '';
    for (const m of tryOrder.slice(0, 3)) { // Try at most 3 providers
      try {
        console.log('[Conv] Trying model:', m);
        const result = await this._callOne(m, params);
        if (result) return result;
      } catch (e: any) {
        lastError = e.message || String(e);
        console.log('[Conv] Model', m, 'failed:', lastError);
      }
    }
    throw new Error('All models failed. Last error: ' + lastError);
  }

  private async _callOne(model: ModelChoice, params: {
    text?: string;
    imageBase64?: string;
    contextMessages?: { role: string; content: string }[];
  }): Promise<{ text: string; tokensUsed: number }> {
    const msgs = params.contextMessages || [];
    switch (model) {
      case 'qwen':
        return qwenClient.multimodalChat({ imageBase64: params.imageBase64, text: params.text, contextMessages: msgs })
          .then(r => ({ text: r.responseText, tokensUsed: r.tokensUsed }));
      case 'deepseek':
        return deepseekClient.chat([...msgs, { role: 'user', content: params.text || '[语音]' }]);
      case 'openai':
        return params.imageBase64
          ? openaiClient.chatWithVision({ imageBase64: params.imageBase64, text: params.text, contextMessages: msgs })
          : openaiClient.chat([...msgs, { role: 'user', content: params.text || '[语音]' }]);
      case 'gemini':
        return params.imageBase64
          ? geminiClient.chatWithVision({ imageBase64: params.imageBase64, text: params.text })
          : geminiClient.chat([...msgs, { role: 'user', content: params.text || '[语音]' }]);
      case 'claude':
        return params.imageBase64
          ? claudeClient.chatWithVision({ imageBase64: params.imageBase64, text: params.text, contextMessages: msgs })
          : claudeClient.chat([...msgs, { role: 'user', content: params.text || '[语音]' }]);
      case 'ollama':
        return params.imageBase64
          ? ollamaClient.chatWithVision({ imageBase64: params.imageBase64, text: params.text })
          : ollamaClient.chat([...msgs, { role: 'user', content: params.text || '[语音]' }]);
      default:
        throw new Error('Unknown model: ' + model);
    }
  }

  /** Reload API keys and model config from preferences (called when settings change) */
  reloadConfig() {
    const prefs = preferenceStore.getAll();
    this.costSummary.dailyBudget = Number(prefs.dailyBudget) || 5;
    this.modelProvider = (prefs.modelProvider as ModelProvider) || 'auto';

    this.availableProviders.clear();
    if (prefs.qwenApiKey?.trim()) this.availableProviders.add('qwen');
    if (prefs.deepseekApiKey?.trim()) this.availableProviders.add('deepseek');
    if (prefs.openaiApiKey?.trim()) this.availableProviders.add('openai');
    if (prefs.geminiApiKey?.trim()) this.availableProviders.add('gemini');
    if (prefs.claudeApiKey?.trim()) this.availableProviders.add('claude');

    // Reload API keys into clients
    qwenClient?.setApiKey(prefs.qwenApiKey || '');
    deepseekClient?.setApiKey(prefs.deepseekApiKey || '');
    openaiClient?.setApiKey(prefs.openaiApiKey || '');
    geminiClient?.setApiKey(prefs.geminiApiKey || '');
    claudeClient?.setApiKey(prefs.claudeApiKey || '');

    // Ollama is local — always try to add it (no API key needed)
    ollamaClient?.isAvailable().then(ok => {
      if (ok) this.availableProviders.add('ollama');
    }).catch(() => {});

    console.log('[Conv] Config reloaded — Provider:', this.modelProvider,
      'Available:', [...this.availableProviders].join(','));
  }
}

export const conversationManager = new ConversationManager();

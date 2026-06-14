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
import { whisperService } from './whisper-service';
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
  private responseCooldownMs = 1500;
  private availableProviders: Set<ModelChoice> = new Set();
  private modelProvider: ModelProvider = 'auto';

  private continuousMode = false;

  init() {
    this.reloadConfig();
    vadService.setCallbacks({
      onSpeechStart: () => {
        if (!this.continuousMode) return;
        this.speechStartTime = Date.now();
        emitState('listening');
        emitTranscript('🎤 正在听...');
      },
      onSpeechEnd: (segments) => {
        if (!this.continuousMode) return;
        this.handleSpeechEnd(segments);
      },
    });
  }

  toggleContinuousMode(enabled: boolean) {
    this.continuousMode = enabled;
    console.log('[Conv] Continuous mode:', enabled ? 'ON' : 'OFF');
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
    // Set cooldown immediately so VAD doesn't trigger again during processing
    this.lastResponseTime = now;

    const speechDuration = ((now - this.speechStartTime) / 1000).toFixed(1);

    const merged = vadService.mergeSegments(segments);
    const wavBuffer = vadService.float32ToWav(merged, 16000);

    // Emit transcript FIRST (before state change) so renderer captures user message
    emitTranscript('⏳ 识别中...');

    // STEP 1: Transcribe the audio
    let transcribedText = '';
    try {
      console.log('[Conv] Transcribing audio, duration:', speechDuration + 's, samples:', merged.length);
      transcribedText = await whisperService.transcribeFromWav(wavBuffer);
      console.log('[Conv] Transcribed:', transcribedText || '(empty)');
    } catch (e: any) {
      console.error('[Conv] Whisper transcription failed:', e.message);
      emitTranscript('⚠️ 语音识别失败: ' + e.message);
    }

    if (!transcribedText.trim()) {
      emitTranscript('⚠️ 未识别到语音内容，请重试');
      emitState('idle');
      return;
    }

    // Show user speech BEFORE state change
    emitTranscript('🎤 ' + transcribedText);

    emitState('processing');

    // STEP 2: Only send frame if user asks about visual environment
    const visualKeywords = /(?:看到|看见|看看|看下|有什么|是什么|面前|画面|描述|环境|周围|镜头|摄像头)/i;
    const userWantsVisual = visualKeywords.test(transcribedText);
    console.log('[Conv] Visual check:', transcribedText.substring(0, 30), '→', userWantsVisual);
    let frameToSend: string | undefined;
    if (userWantsVisual && this.lastFrameBase64 && this.lastFrameDhash) {
      frameToSend = this.lastFrameBase64;
      this.lastFrameSentTime = Date.now();
    }

    const input: ConversationInput = {
      hasNewImage: !!frameToSend, hasSpeech: true, hasTextInput: false,
      isAccessibilityMode: this.isAccessibilityMode, isFollowUp: false,
    };
    const modelChoice = modelRouter.route(input, this.availableProviders, this.modelProvider);

    // Show user speech as a message immediately
    const userContent = transcribedText;

    try {
      const ctx = contextManager.getContext();
      // Use recent turns only (buildMessages appends current message, but _callOne also adds it)
      // So we pass context WITHOUT the current user message to avoid duplication
      const sysMsg = '你是用户的AI聊天伙伴。重要规则：1) 正常对话时只回应用户说的话，不要描述画面；2) 只有用户明确说"看看""描述一下""我面前有什么"时才看图回答；3) 回答尽量简短，像微信聊天一样。';
      const contextMsgs: { role: string; content: string }[] = [{ role: 'system', content: sysMsg }];
      for (const t of ctx.recentTurns) {
        if (t.role === 'user' || t.role === 'assistant') {
          contextMsgs.push({ role: t.role, content: t.content });
        }
      }
      const result = await this.callAI(modelChoice, {
        text: transcribedText,
        imageBase64: frameToSend,
        contextMessages: contextMsgs,
      });

      const response: AIResponse = {
        text: result.text, modelUsed: modelChoice, tokensUsed: result.tokensUsed,
      };
      emitResponse(response);
      emitState('speaking');

      try { await ttsService.synthesizeToBase64(response.text); } catch {}

      contextManager.addTurn({ role: 'user', content: userContent, modelUsed: modelChoice, tokensUsed: 0 });
      contextManager.addTurn({ role: 'assistant', content: response.text, modelUsed: modelChoice, tokensUsed: result.tokensUsed });

      this.updateCost(result.tokensUsed, modelChoice);
      this.lastResponseTime = Date.now();
      emitState('idle');
    } catch (error: any) {
      console.error('[Conv] Speech error:', error.message);
      this.lastResponseTime = Date.now();  // Cooldown even on error — prevent loop!
      emitTranscript('❌ AI 调用失败: ' + (error.message || '未知错误'));
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
      const ctx = contextManager.getContext();
      const sysPrompt = '你是用户的AI聊天伙伴。重要规则：1) 正常对话时只回应用户说的话，不要描述画面；2) 只有用户明确说"看看""描述一下""我面前有什么"时才看图回答；3) 回答尽量简短，像微信聊天一样。';
      const contextMsgs: { role: string; content: string }[] = [{ role: 'system', content: sysPrompt }];
      for (const t of ctx.recentTurns) {
        if (t.role === 'user' || t.role === 'assistant') {
          contextMsgs.push({ role: t.role, content: t.content });
        }
      }
      const result = await this._callOne(modelChoice, {
        text,
        imageBase64: frameToSend,
        contextMessages: contextMsgs,
      });
      response = { text: result.text, modelUsed: modelChoice, tokensUsed: result.tokensUsed };

      // Cache visual description if Qwen returned one
      if (modelChoice === 'qwen' && frameToSend) {
        try {
          const desc = await qwenClient.describeImage(frameToSend);
          if (desc?.description) frameDedup.cacheDescription(desc.description);
        } catch { /* best-effort */ }
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
    const hasImage = !!params.imageBase64;
    // Try preferred model, then fall back to available providers
    const fallbacks = [...this.availableProviders].filter(p => p !== model);
    // If image present, prefer vision models in fallback order
    if (hasImage) {
      fallbacks.sort((a, b) => {
        const aVis = modelRouter.supportsVision(a) ? 0 : 1;
        const bVis = modelRouter.supportsVision(b) ? 0 : 1;
        return aVis - bVis;
      });
    }
    const tryOrder = [model, ...fallbacks];

    let lastError = '';
    for (const m of tryOrder.slice(0, 3)) { // Try at most 3 providers
      try {
        console.log('[Conv] Trying model:', m, hasImage ? '(image)' : '(text)');
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
    const hasImage = !!params.imageBase64;
    const modelSupportsVision = modelRouter.supportsVision(model);
    const userText = params.text || '[语音]';

    // If model doesn't support vision but we have an image, prepend a text description
    let effectiveText = userText;
    if (hasImage && !modelSupportsVision) {
      // Try cached description first, then try Qwen quick describe, then generic note
      const cached = frameDedup.getCachedDescription();
      if (cached) {
        effectiveText = `[画面描述] ${cached}\n\n[用户] ${userText}`;
      } else {
        // Try to get a quick description from Qwen (may fail if key overdue)
        try {
          const desc = await qwenClient.describeImage(params.imageBase64!);
          if (desc?.description) {
            frameDedup.cacheDescription(desc.description);
            effectiveText = `[画面描述] ${desc.description}\n\n[用户] ${userText}`;
          }
        } catch {
          effectiveText = `[注意：用户发送了图片但无视觉模型可用]\n\n${userText}`;
        }
      }
    }

    switch (model) {
      case 'qwen':
        return qwenClient.multimodalChat({ imageBase64: params.imageBase64, text: userText, contextMessages: msgs })
          .then(r => ({ text: r.responseText, tokensUsed: r.tokensUsed }));
      case 'deepseek':
        return deepseekClient.chat([...msgs, { role: 'user', content: effectiveText }]);
      case 'openai':
        return params.imageBase64
          ? openaiClient.chatWithVision({ imageBase64: params.imageBase64, text: userText, contextMessages: msgs })
          : openaiClient.chat([...msgs, { role: 'user', content: userText }]);
      case 'gemini':
        return params.imageBase64
          ? geminiClient.chatWithVision({ imageBase64: params.imageBase64, text: userText })
          : geminiClient.chat([...msgs, { role: 'user', content: userText }]);
      case 'claude':
        return params.imageBase64
          ? claudeClient.chatWithVision({ imageBase64: params.imageBase64, text: userText, contextMessages: msgs })
          : claudeClient.chat([...msgs, { role: 'user', content: userText }]);
      case 'ollama':
        return params.imageBase64
          ? ollamaClient.chatWithVision({ imageBase64: params.imageBase64, text: userText })
          : ollamaClient.chat([...msgs, { role: 'user', content: userText }]);
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

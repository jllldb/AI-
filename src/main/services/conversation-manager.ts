import { AIResponse, ConversationInput, ModelChoice, CostSummary } from '../../shared/types';
import { vadService } from './vad-service';
import { frameDedup } from './frame-dedup';
import { contextManager } from './context-manager';
import { modelRouter } from '../router/model-router';
import { qwenClient } from '../clients/qwen-client';
import { deepseekClient } from '../clients/deepseek-client';
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

  init() {
    const prefs = preferenceStore.getAll();
    this.costSummary.dailyBudget = Number(prefs.dailyBudget) || 5;

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
    emitState('processing');
    const speechDuration = ((Date.now() - this.speechStartTime) / 1000).toFixed(1);

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
    const modelChoice = modelRouter.route(input);

    // Show user speech as a message immediately
    const userContent = `🎤 语音输入 (${speechDuration}s)`;
    emitTranscript(userContent);

    try {
      let response: AIResponse;
      if (modelChoice === 'qwen-omni') {
        const context = contextManager.getContext();
        const qr = await qwenClient.multimodalChat({
          imageBase64: frameToSend, audioBase64,
          contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
        });
        // Show transcription if available
        const transcription = qr.transcription || userContent;
        emitTranscript(transcription);

        response = {
          text: qr.responseText, visualDescription: qr.visualDescription,
          modelUsed: 'qwen-omni', tokensUsed: qr.tokensUsed,
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
      emitState('idle');
    } catch (error) {
      console.error('Conv error:', error);
      emitTranscript('❌ 识别失败，请重试');
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
    const modelChoice = modelRouter.route(input);

    let response: AIResponse;
    if (modelChoice === 'qwen-omni' && frameToSend) {
      const context = contextManager.getContext();
      const qr = await qwenClient.multimodalChat({
        imageBase64: frameToSend, text,
        contextMessages: context.recentTurns.map(t => ({ role: t.role, content: t.content })),
      });
      response = { text: qr.responseText, visualDescription: qr.visualDescription, modelUsed: 'qwen-omni', tokensUsed: qr.tokensUsed };
      if (qr.visualDescription) frameDedup.cacheDescription(qr.visualDescription);
    } else {
      const context = contextManager.getContext();
      const messages = contextManager.buildMessages(context, text);
      const dr = await deepseekClient.chat(messages);
      response = { text: dr.text, modelUsed: 'deepseek', tokensUsed: dr.tokensUsed };
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
    const isSig = frameDedup.isSignificantChange(this.lastFrameDhash);
    const forceRefresh = (Date.now() - this.lastFrameSentTime) > 60000;
    if (!isSig && !forceRefresh) return;
    try {
      const { description, tokensUsed } = await qwenClient.describeImage(this.lastFrameBase64);
      frameDedup.cacheDescription(description);
      this.lastFrameSentTime = Date.now();
      const resp: AIResponse = { text: description, visualDescription: description, modelUsed: 'qwen-omni', tokensUsed };
      emitResponse(resp);
      emitState('speaking');
      try { await ttsService.synthesizeToBase64(description); } catch {}
      contextManager.addTurn({ role: 'system', content: '[场景] ' + description, visualDescription: description, modelUsed: 'qwen-omni', tokensUsed });
      this.updateCost(tokensUsed, 'qwen-omni');
      emitState('idle');
    } catch (e) { console.error('accessibility tick:', e); }
  }

  private updateCost(tokens: number, model: ModelChoice) {
    const price = model === 'qwen-omni' ? COST.QWEN_PRICE_PER_1K_TOKENS : COST.DEEPSEEK_PRICE_PER_1K_TOKENS;
    this.costSummary.todayTokens += tokens;
    this.costSummary.todayCost += (tokens / 1000) * price;
    emitCost(this.costSummary);
  }

  getCostSummary(): CostSummary { return { ...this.costSummary }; }
}

export const conversationManager = new ConversationManager();

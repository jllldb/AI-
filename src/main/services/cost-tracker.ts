import type { ICostTracker } from '../core/interfaces';
import type { CostSummary, ModelChoice } from '../../shared/types';
import type { IPreferenceStore } from '../core/interfaces';
import { COST } from '../../shared/constants';

const PRICES: Record<string, number> = {
  qwen: COST.QWEN_PRICE_PER_1K_TOKENS,
  deepseek: COST.DEEPSEEK_PRICE_PER_1K_TOKENS,
  openai: 0.0025,
  gemini: 0.0005,
  claude: 0.003,
};

export class CostTracker implements ICostTracker {
  private _summary: CostSummary = {
    todayTokens: 0, todayCost: 0, dailyBudget: 5,
    callsSavedByVAD: 0, callsSavedByDedup: 0, callsSavedByCache: 0,
  };

  constructor(private prefs: IPreferenceStore) {
    this._summary.dailyBudget = Number(prefs.get('dailyBudget')) || 5;
  }

  get summary(): CostSummary {
    return { ...this._summary };
  }

  recordUsage(tokens: number, model: ModelChoice): void {
    const price = PRICES[model] ?? 0.0015;
    this._summary.todayTokens += tokens;
    this._summary.todayCost += (tokens / 1000) * price;
  }

  resetDaily(): void {
    this._summary.todayTokens = 0;
    this._summary.todayCost = 0;
  }

  /** Increment VAD-saved call counter */
  incrementSavedByVAD(): void { this._summary.callsSavedByVAD++; }
  /** Increment dedup-saved call counter */
  incrementSavedByDedup(): void { this._summary.callsSavedByDedup++; }
  /** Increment cache-saved call counter */
  incrementSavedByCache(): void { this._summary.callsSavedByCache++; }
}

import type { IFrameDedup } from '../core/interfaces';

export class FrameDedup implements IFrameDedup {
  private lastHash: bigint | null = null;
  private lastDescription: string | null = null;
  private consecutiveSimilarCount = 0;

  isDuplicate(hash: bigint, threshold = 5): boolean {
    if (this.lastHash === null) {
      this.lastHash = hash;
      this.consecutiveSimilarCount = 1;
      return false;
    }
    const distance = this.hammingDistance(this.lastHash, hash);
    if (distance <= threshold) {
      this.consecutiveSimilarCount++;
      return true;
    }
    this.lastHash = hash;
    this.consecutiveSimilarCount = 1;
    return false;
  }

  isSignificantChange(hash: bigint): boolean {
    if (this.lastHash === null) return true;
    return this.hammingDistance(this.lastHash, hash) > 10;
  }

  private hammingDistance(a: bigint, b: bigint): number {
    let xor = a ^ b, count = 0;
    while (xor > 0n) { count++; xor &= xor - 1n; }
    return count;
  }

  cacheDescription(desc: string) { this.lastDescription = desc; }
  getCachedDescription(): string | null {
    return this.consecutiveSimilarCount >= 3 ? this.lastDescription : null;
  }
  reset() { this.lastHash = null; this.lastDescription = null; this.consecutiveSimilarCount = 0; }
  getConsecutiveCount(): number { return this.consecutiveSimilarCount; }
}

export const frameDedup = new FrameDedup();

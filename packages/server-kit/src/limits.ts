// Kayan 24 saatlik pencere sınırı. Bellek içi: süreç yeniden başlarsa sıfırlanır (kalıcı depo — Redis vb. — sonraki adım).
const DAY = 24 * 60 * 60_000;

export class DailyLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private now: () => number = Date.now) {}

  private live(key: string) {
    const t = this.now(), arr = (this.hits.get(key) ?? []).filter((x) => x > t - DAY);
    if (arr.length) this.hits.set(key, arr); else this.hits.delete(key);
    return arr;
  }
  /** Tüm anahtarlar (IP ve oturum ayrı ayrı) sınırın altındaysa true. */
  check(keys: string[]): { ok: boolean; remaining: number; retryAfterSec: number } {
    let remaining = this.max, retry = 0;
    for (const k of keys) {
      const arr = this.live(k);
      remaining = Math.min(remaining, this.max - arr.length);
      if (arr.length >= this.max) retry = Math.max(retry, Math.ceil((arr[0] + DAY - this.now()) / 1000));
    }
    return { ok: remaining > 0, remaining: Math.max(0, remaining), retryAfterSec: retry };
  }
  consume(keys: string[]) { for (const k of keys) { const a = this.live(k); a.push(this.now()); this.hits.set(k, a); } }
  sweep() { for (const k of [...this.hits.keys()]) this.live(k); }
}

export class MinuteLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private max: number, private now: () => number = Date.now) {}
  hit(key: string): boolean {
    const t = this.now(), h = this.hits.get(key);
    if (!h || h.reset < t) { this.hits.set(key, { n: 1, reset: t + 60_000 }); return true; }
    return ++h.n <= this.max;
  }
  sweep() { const t = this.now(); for (const [k, v] of this.hits) if (v.reset < t) this.hits.delete(k); }
}

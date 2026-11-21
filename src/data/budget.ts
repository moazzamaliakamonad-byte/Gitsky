/**
 * Request budget: knows how many GitHub API calls we may still make this hour.
 *
 * GitHub tells us after every response via headers:
 *   X-RateLimit-Limit      60 (no token) or 5000 (token)
 *   X-RateLimit-Remaining  calls left in this window
 *   X-RateLimit-Reset      when the window resets (unix seconds)
 *
 * We keep a small reserve so a user can still load one more small repo after a
 * big one, and we decrement optimistically before each call so parallel
 * requests can't overshoot.
 */
export interface RateState {
  limit: number;
  remaining: number;
  /** Epoch milliseconds. */
  resetAt: number;
}

export type HeaderGetter = (name: string) => string | null;

export class RequestBudget {
  private s: RateState;

  constructor(
    initial: Partial<RateState> = {},
    readonly reserve = 2,
  ) {
    const limit = initial.limit ?? 60;
    this.s = { limit, remaining: initial.remaining ?? limit, resetAt: initial.resetAt ?? 0 };
  }

  get state(): RateState {
    return { ...this.s };
  }

  /** Overwrite from an authoritative source (e.g. GET /rate_limit). */
  set(state: RateState): void {
    this.s = { ...state };
  }

  updateFromHeaders(get: HeaderGetter): void {
    const limit = num(get('x-ratelimit-limit'));
    const remaining = num(get('x-ratelimit-remaining'));
    const resetSec = num(get('x-ratelimit-reset'));
    if (remaining === null || resetSec === null) return;
    const resetAt = resetSec * 1000;

    if (resetAt > this.s.resetAt) {
      // A new window: trust it fully.
      this.s = { limit: limit ?? this.s.limit, remaining, resetAt };
    } else if (resetAt === this.s.resetAt) {
      // Same window: responses can arrive out of order, so remaining only goes down.
      this.s.remaining = Math.min(this.s.remaining, remaining);
      if (limit !== null) this.s.limit = limit;
    }
    // Older window: stale response, ignore.
  }

  /** Calls we can still make, after keeping the reserve. */
  available(now = Date.now()): number {
    const remaining = this.s.resetAt > 0 && now >= this.s.resetAt ? this.s.limit : this.s.remaining;
    return Math.max(0, remaining - this.reserve);
  }

  /** For planning: can we afford n calls and still keep the reserve? */
  canSpend(n = 1, now = Date.now()): boolean {
    return this.available(now) >= n;
  }

  /** Hard gate for a single request: is any quota left at all (ignoring the reserve)? */
  hasQuota(n = 1, now = Date.now()): boolean {
    const remaining = this.s.resetAt > 0 && now >= this.s.resetAt ? this.s.limit : this.s.remaining;
    return remaining >= n;
  }

  spend(n = 1, now = Date.now()): void {
    if (this.s.resetAt > 0 && now >= this.s.resetAt) {
      this.s.remaining = this.s.limit;
    }
    this.s.remaining = Math.max(0, this.s.remaining - n);
  }
}

function num(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * How many commit-detail calls (1 call per commit) can we afford?
 * `baseCalls` are the calls still needed regardless (e.g. the tree).
 */
export function planSampleSize(opts: {
  available: number;
  baseCalls: number;
  desired: number;
  listed: number;
}): number {
  const room = opts.available - opts.baseCalls;
  return Math.max(0, Math.min(opts.desired, opts.listed, room));
}

import { describe, expect, it } from 'vitest';
import { RequestBudget, planSampleSize } from '../src/data/budget';

const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null;

describe('RequestBudget', () => {
  it('starts with the assumed unauthenticated limit', () => {
    const b = new RequestBudget();
    expect(b.state.limit).toBe(60);
    expect(b.state.remaining).toBe(60);
  });

  it('reads X-RateLimit headers', () => {
    const b = new RequestBudget();
    b.updateFromHeaders(
      headers({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '12',
        'x-ratelimit-reset': '1700000000',
      }),
    );
    expect(b.state).toEqual({ limit: 60, remaining: 12, resetAt: 1700000000 * 1000 });
  });

  it('ignores missing or garbage headers', () => {
    const b = new RequestBudget({ limit: 60, remaining: 30, resetAt: 5 });
    b.updateFromHeaders(headers({ 'x-ratelimit-remaining': 'abc' }));
    expect(b.state.remaining).toBe(30);
  });

  it('keeps a reserve: available = remaining - reserve', () => {
    const b = new RequestBudget({ limit: 60, remaining: 10, resetAt: Date.now() + 60_000 }, 3);
    expect(b.available()).toBe(7);
  });

  it('never reports negative availability', () => {
    const b = new RequestBudget({ limit: 60, remaining: 1, resetAt: Date.now() + 60_000 }, 3);
    expect(b.available()).toBe(0);
    expect(b.canSpend(1)).toBe(false);
  });

  it('spend() decrements optimistically until the next headers arrive', () => {
    const b = new RequestBudget({ limit: 60, remaining: 10, resetAt: Date.now() + 60_000 }, 0);
    b.spend();
    b.spend(2);
    expect(b.state.remaining).toBe(7);
  });

  it('refills once the reset time has passed', () => {
    const now = 1_000_000;
    const b = new RequestBudget({ limit: 60, remaining: 0, resetAt: now - 1 }, 0);
    expect(b.available(now)).toBe(60);
    expect(b.canSpend(5, now)).toBe(true);
  });

  it('an older response with a higher remaining count does not undo spending', () => {
    // Responses can arrive out of order; within one reset window, remaining only goes down.
    const b = new RequestBudget({ limit: 60, remaining: 20, resetAt: 2000 * 1000 }, 0);
    b.updateFromHeaders(
      headers({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '25',
        'x-ratelimit-reset': '2000',
      }),
    );
    expect(b.state.remaining).toBe(20);
  });
});

describe('planSampleSize', () => {
  it('asks for what is desired when the budget allows', () => {
    expect(planSampleSize({ available: 50, baseCalls: 3, desired: 25, listed: 100 })).toBe(25);
  });

  it('shrinks to fit the remaining budget after base calls', () => {
    expect(planSampleSize({ available: 12, baseCalls: 3, desired: 25, listed: 100 })).toBe(9);
  });

  it('never exceeds the number of listed commits', () => {
    expect(planSampleSize({ available: 500, baseCalls: 3, desired: 300, listed: 40 })).toBe(40);
  });

  it('returns 0 when even base calls do not fit', () => {
    expect(planSampleSize({ available: 2, baseCalls: 3, desired: 25, listed: 100 })).toBe(0);
  });
});

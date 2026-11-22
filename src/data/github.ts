import type { RateState, RequestBudget } from './budget';

export const API_ORIGIN = 'https://api.github.com';

export type GitHubErrorKind =
  | 'not_found'
  | 'rate_limited'
  | 'bad_token'
  | 'empty'
  | 'network'
  | 'http';

export class GitHubError extends Error {
  constructor(
    readonly kind: GitHubErrorKind,
    message: string,
    readonly status?: number,
    /** Epoch ms when the rate limit resets (rate_limited only). */
    readonly resetAt?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubClient {
  /** GET a JSON resource. `path` starts with '/'. Spends one call from the budget. */
  getJson<T>(path: string): Promise<T>;
  /** Like getJson, plus the Link header (pagination: how many pages there are). */
  getJsonWithLink<T>(path: string): Promise<{ data: T; link: string | null }>;
  /** GET /rate_limit. Free: does not count against the limit. */
  rateLimit(): Promise<RateState>;
  readonly hasToken: boolean;
}

export interface ClientOptions {
  budget: RequestBudget;
  token?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export function createGitHubClient(opts: ClientOptions): GitHubClient {
  const doFetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const token = opts.token?.trim() || undefined;

  async function request(path: string): Promise<Response> {
    const url = `${API_ORIGIN}${path}`;
    // Defense in depth: the token must never leave for any other host.
    if (!url.startsWith(`${API_ORIGIN}/`)) throw new Error('Refusing non-GitHub URL');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await doFetch(url, { headers, signal: opts.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new GitHubError(
        'network',
        "Couldn't reach GitHub. Check your connection and try again.",
      );
    }
  }

  async function getResponse(path: string): Promise<Response> {
    const { budget } = opts;
    if (!budget.hasQuota(1)) {
      throw new GitHubError(
        'rate_limited',
        'GitHub API limit reached for this hour.',
        403,
        budget.state.resetAt || undefined,
      );
    }
    budget.spend(1);
    const res = await request(path);
    budget.updateFromHeaders((n) => res.headers.get(n));
    if (res.ok) return res;
    throw await toError(res);
  }

  return {
    hasToken: Boolean(token),

    async getJson<T>(path: string): Promise<T> {
      return (await (await getResponse(path)).json()) as T;
    },

    async getJsonWithLink<T>(path: string) {
      const res = await getResponse(path);
      return { data: (await res.json()) as T, link: res.headers.get('link') };
    },

    async rateLimit(): Promise<RateState> {
      const res = await request('/rate_limit');
      if (!res.ok) throw await toError(res);
      const body = (await res.json()) as {
        resources: { core: { limit: number; remaining: number; reset: number } };
      };
      const c = body.resources.core;
      const state = { limit: c.limit, remaining: c.remaining, resetAt: c.reset * 1000 };
      opts.budget.set(state);
      return state;
    },
  };
}

async function toError(res: Response): Promise<GitHubError> {
  let message = '';
  try {
    message = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    // Body wasn't JSON; the status code is enough.
  }
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const resetAt = Number.isFinite(reset) && reset > 0 ? reset * 1000 : undefined;

  if (res.status === 404) {
    return new GitHubError('not_found', "That repo doesn't exist, or it's private.", 404);
  }
  if (res.status === 401) {
    return new GitHubError(
      'bad_token',
      'GitHub rejected the token. It may be expired or mistyped.',
      401,
    );
  }
  if (
    (res.status === 403 || res.status === 429) &&
    (remaining === '0' || /rate limit/i.test(message))
  ) {
    return new GitHubError(
      'rate_limited',
      'GitHub API limit reached for this hour.',
      res.status,
      resetAt,
    );
  }
  if (res.status === 409 && /empty/i.test(message)) {
    return new GitHubError('empty', 'This repository is empty: no commits yet.', 409);
  }
  return new GitHubError(
    'http',
    `GitHub answered ${res.status}${message ? `: ${message}` : ''}.`,
    res.status,
  );
}

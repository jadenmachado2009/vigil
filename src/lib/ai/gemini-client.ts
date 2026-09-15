/**
 * One way to call Gemini, shared by the chart reader and the strategy parser.
 *
 * Google's free tier is capacity-limited: on the day this was written, small
 * requests succeeded while larger ones were refused with "This model is
 * currently experiencing high demand", and one model answered while its
 * neighbour did not. So a single request is not enough. This retries busy and
 * rate-limited responses with backoff, moves to a fallback model when one is
 * saturated or unavailable, and reports Google's reason in plain words.
 *
 * It never retries a rejected key — no other model will accept it either — and
 * no error message it produces ever contains the key.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(message: string, readonly status: number | null, readonly retryable: boolean) {
    super(message);
    this.name = 'GeminiError';
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GenerateOptions {
  apiKey: string;
  /** Primary model first, then fallbacks in order. Duplicates are ignored. */
  models: string[];
  /** The generateContent request body. */
  body: unknown;
  /** Per-request timeout. */
  timeoutMs: number;
  /** Total time across every attempt and model. */
  budgetMs: number;
  attemptsPerModel?: number;
  /** Injected in tests. */
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

interface Verdict { message: string; retrySameModel: boolean; tryNextModel: boolean }

function classify(status: number, googleMessage: string | null, model: string): Verdict {
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { message: 'Gemini is busy right now (high demand). Try again shortly.', retrySameModel: true, tryNextModel: true };
  }
  if (status === 429) {
    return {
      message: 'Gemini rate limit reached. Free keys are capped per minute and per day.',
      retrySameModel: true,
      tryNextModel: true, // quotas are counted per model
    };
  }
  if (status === 401 || status === 403) {
    return { message: 'The Gemini key was rejected. Check GEMINI_API_KEY in .env.local.', retrySameModel: false, tryNextModel: false };
  }
  if (status === 404) {
    return { message: `The model ${model} is not available to this key.`, retrySameModel: false, tryNextModel: true };
  }
  const detail = googleMessage ? `: ${googleMessage.slice(0, 160)}` : '';
  return { message: `Gemini refused the request (${status})${detail}`, retrySameModel: false, tryNextModel: false };
}

async function googleMessage(response: Response): Promise<string | null> {
  try {
    const parsed = (await response.json()) as { error?: { message?: unknown } };
    return typeof parsed.error?.message === 'string' ? parsed.error.message : null;
  } catch {
    return null;
  }
}

/** Never let a key leak into anything shown to a person or written to a log. */
function scrub(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join('[key]') : text;
}

export async function generateJson(options: GenerateOptions): Promise<{ text: string; model: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const attempts = Math.max(1, options.attemptsPerModel ?? 2);
  const deadline = now() + options.budgetMs;
  const models = [...new Set(options.models.map((m) => m.trim()).filter(Boolean))];

  const fail = (message: string, status: number | null, retryable: boolean) =>
    new GeminiError(scrub(message, options.apiKey), status, retryable);

  let last: GeminiError | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const remaining = deadline - now();
      if (remaining <= 0) throw last ?? fail('Gemini did not respond in time.', null, true);

      let response: Response;
      try {
        response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
          body: JSON.stringify(options.body),
          signal: AbortSignal.timeout(Math.max(1000, Math.min(options.timeoutMs, remaining))),
        });
      } catch (error) {
        last = fail(`Could not reach Gemini: ${error instanceof Error ? error.message : 'network error'}`, null, true);
        if (attempt < attempts - 1) await sleep(Math.min(backoff(attempt, random), Math.max(0, deadline - now())));
        continue;
      }

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
          | null;
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, model };
        last = fail('Gemini returned an empty response.', response.status, true);
        if (attempt < attempts - 1) await sleep(Math.min(backoff(attempt, random), Math.max(0, deadline - now())));
        continue;
      }

      const verdict = classify(response.status, await googleMessage(response), model);
      last = fail(verdict.message, response.status, verdict.retrySameModel);
      if (!verdict.retrySameModel && !verdict.tryNextModel) throw last;
      if (!verdict.retrySameModel) break;
      if (attempt < attempts - 1) await sleep(Math.min(backoff(attempt, random), Math.max(0, deadline - now())));
    }
  }

  throw last ?? fail('Gemini is unavailable.', null, true);
}

/** 700ms, 1.4s, 2.8s… with jitter, so parallel callers do not retry in lockstep. */
function backoff(attempt: number, random: () => number): number {
  return Math.round(700 * 2 ** attempt + random() * 250);
}

import { describe, it, expect } from 'vitest';
import { generateJson, GeminiError } from '@/lib/ai/gemini-client';

const KEY = 'SECRET-KEY-123';

type Reply = { status: number; body?: unknown } | Error;

/** A fake Gemini: replies are consumed in order per model. */
function fakeGemini(script: Record<string, Reply[]>) {
  const calls: string[] = [];
  const fetchImpl = async (url: string, _init?: RequestInit): Promise<Response> => {
    const model = url.split('/models/')[1]!.split(':')[0]!;
    calls.push(model);
    const next = script[model]?.shift();
    if (!next) throw new Error(`unscripted call to ${model}`);
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  };
  return { fetchImpl, calls };
}

const ok = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } });
const busy = { status: 503, body: { error: { message: 'This model is currently experiencing high demand.' } } };

const base = {
  apiKey: KEY,
  body: {},
  timeoutMs: 5000,
  budgetMs: 60_000,
  attemptsPerModel: 2,
  sleep: async () => {},
  random: () => 0,
};

describe('gemini client', () => {
  it('returns the text and the model that answered', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [ok('{"a":1}')] });
    const out = await generateJson({ ...base, models: ['primary', 'backup'], fetchImpl });
    expect(out).toEqual({ text: '{"a":1}', model: 'primary' });
    expect(calls).toEqual(['primary']);
  });

  it('retries a busy model and succeeds on the second attempt', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [busy, ok('{}')] });
    const out = await generateJson({ ...base, models: ['primary', 'backup'], fetchImpl });
    expect(out.model).toBe('primary');
    expect(calls).toEqual(['primary', 'primary']);
  });

  it('falls back to the next model when the primary stays busy', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [busy, busy], backup: [ok('{}')] });
    const out = await generateJson({ ...base, models: ['primary', 'backup'], fetchImpl });
    expect(out.model).toBe('backup');
    expect(calls).toEqual(['primary', 'primary', 'backup']);
  });

  it('moves straight to the next model when one is not available, without retrying it', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [{ status: 404 }], backup: [ok('{}')] });
    const out = await generateJson({ ...base, models: ['primary', 'backup'], fetchImpl });
    expect(out.model).toBe('backup');
    expect(calls).toEqual(['primary', 'backup']);
  });

  it('stops immediately on a rejected key — no other model will accept it', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [{ status: 403 }], backup: [ok('{}')] });
    await expect(generateJson({ ...base, models: ['primary', 'backup'], fetchImpl }))
      .rejects.toThrow(/key was rejected/);
    expect(calls).toEqual(['primary']);
  });

  it('reports busy in plain words when every model is saturated', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [busy, busy], backup: [busy, busy] });
    const error = await generateJson({ ...base, models: ['primary', 'backup'], fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiError);
    expect(error.message).toMatch(/busy right now/);
    expect(error.status).toBe(503);
    expect(calls).toHaveLength(4);
  });

  it('treats an empty answer as retryable', async () => {
    const { fetchImpl } = fakeGemini({ primary: [{ status: 200, body: { candidates: [] } }, ok('{"b":2}')] });
    expect((await generateJson({ ...base, models: ['primary'], fetchImpl })).text).toBe('{"b":2}');
  });

  it('retries a network failure', async () => {
    const { fetchImpl } = fakeGemini({ primary: [new Error('ECONNRESET'), ok('{}')] });
    expect((await generateJson({ ...base, models: ['primary'], fetchImpl })).model).toBe('primary');
  });

  it('stops when the time budget runs out', async () => {
    let clock = 0;
    const { fetchImpl, calls } = fakeGemini({ primary: [busy, busy], backup: [ok('{}')] });
    const slowFetch = async (url: string, init: RequestInit) => { clock += 40_000; return fetchImpl(url, init); };
    await expect(generateJson({ ...base, models: ['primary', 'backup'], fetchImpl: slowFetch, now: () => clock, budgetMs: 60_000 }))
      .rejects.toThrow(/busy/);
    expect(calls.length).toBeLessThan(3);
  });

  it('ignores duplicate and blank model names', async () => {
    const { fetchImpl, calls } = fakeGemini({ primary: [busy, busy] });
    await generateJson({ ...base, models: ['primary', ' primary ', ''], fetchImpl }).catch(() => {});
    expect(calls).toEqual(['primary', 'primary']);
  });

  it('never puts the key in an error message', async () => {
    const { fetchImpl } = fakeGemini({ primary: [new Error(`connect failed for ${KEY}`), new Error(`again ${KEY}`)] });
    const error = await generateJson({ ...base, models: ['primary'], fetchImpl }).catch((e) => e);
    expect(error.message).not.toContain(KEY);
    expect(error.message).toContain('[key]');
  });
});

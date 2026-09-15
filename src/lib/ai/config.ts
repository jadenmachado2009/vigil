/**
 * The model Vigil asks for when none is configured.
 *
 * Google retires model names on a rolling basis — gemini-2.0-flash, the
 * original default here, was shut down. Set GEMINI_VISION_MODEL or
 * GEMINI_TEXT_MODEL to override without a code change.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * True when Gemini has been chosen but no key has been supplied.
 *
 * The app still works in that state — it falls back to the labelled demo
 * reader or the built-in parser — but it must say so. Someone who set
 * VISION_PROVIDER=gemini believes the AI is on.
 */
export function geminiChosenWithoutKey(setting: 'VISION_PROVIDER' | 'STRATEGY_PARSER'): boolean {
  return (process.env[setting] ?? '').toLowerCase() === 'gemini' && !process.env['GEMINI_API_KEY'];
}

export const MISSING_KEY_WARNING =
  'Gemini is switched on but GEMINI_API_KEY is empty, so the built-in fallback was used. Add the key to .env.local and restart.';

/**
 * Models to try when the primary is saturated or unavailable. gemini-3.6-flash
 * answered during the demand spike that refused the primary. Override with a
 * comma-separated GEMINI_FALLBACK_MODELS.
 */
export const DEFAULT_FALLBACK_MODELS = ['gemini-3.6-flash'];

export function geminiFallbackModels(): string[] {
  const raw = process.env['GEMINI_FALLBACK_MODELS'];
  if (raw === undefined) return DEFAULT_FALLBACK_MODELS;
  return raw.split(',').map((m) => m.trim()).filter(Boolean);
}

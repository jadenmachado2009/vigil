import { DEFAULT_GEMINI_MODEL } from './config';
import type { VisionProvider, VisionRequest, VisionResult } from './types';
import { ProviderUnavailableError } from './types';
import { parseObservations } from './parse';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Reads chart screenshots with Google's vision models.
 *
 * Runs server-side only. The key is read from the environment at call time and
 * never leaves this module.
 *
 * The model is asked ONLY for things a picture can show: whether a structure is
 * present, and what the price levels are. It is never asked for a risk/reward
 * ratio, and never asked whether a setup is good. Those are the rules engine's job.
 */
export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'Gemini vision';
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env['GEMINI_VISION_MODEL'] || DEFAULT_GEMINI_MODEL,
  ) {}

  async readChart(request: VisionRequest): Promise<VisionResult> {
    if (!this.apiKey) throw new ProviderUnavailableError('No vision API key is configured.');

    const schema = request.requestedMetrics.map((m) => {
      const type = m.kind === 'boolean' ? 'true/false'
        : m.kind === 'numeric' ? 'number'
        : m.kind === 'temporal' ? 'ISO-8601 timestamp'
        : 'short string';
      return `- "${m.id}" (${type}): ${m.description}`;
    }).join('\n');

    const prompt = [
      'You are reading trading chart screenshots. Report only what is visibly true.',
      '',
      'Return a single JSON object. For each key below, return either the value, or',
      'an object {"value": <value|null>, "confidence": 0-1, "pending": boolean, "note": string}.',
      '',
      'Rules you must follow:',
      '- If something is not clearly visible, return null. Never guess.',
      '- Use "pending": true when a condition has not formed YET but still could.',
      '- Do not compute ratios, percentages, or risk/reward. Report raw levels only.',
      '- Do not judge whether the setup is good. That is decided elsewhere.',
      '',
      'Keys to report:',
      schema,
      request.notes ? `\nContext from the trader (may be wrong; prefer the chart):\n${request.notes}` : '',
    ].join('\n');

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          ...request.images.map((image) => ({
            inline_data: { mime_type: image.mimeType, data: image.base64 },
          })),
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };

    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      throw new ProviderUnavailableError(
        `Could not reach the vision provider: ${error instanceof Error ? error.message : 'network error'}`,
        true,
      );
    }

    if (response.status === 429) {
      throw new ProviderUnavailableError('The vision provider rate limit was reached. Try again shortly.', true);
    }
    if (!response.ok) {
      throw new ProviderUnavailableError(`The vision provider returned ${response.status}.`, response.status >= 500);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ProviderUnavailableError('The vision provider returned an empty response.', true);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ProviderUnavailableError('The vision provider returned malformed JSON.', true);
    }

    const { observations, warnings } = parseObservations(raw, request.requestedMetrics, {
      source: 'vision',
      asOf: new Date().toISOString(),
    });
    return { observations, providerName: `${this.name} (${this.model})`, warnings };
  }
}

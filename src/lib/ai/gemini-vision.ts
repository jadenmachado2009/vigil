import { DEFAULT_GEMINI_MODEL, geminiFallbackModels } from './config';
import { generateJson } from './gemini-client';
import type { VisionProvider, VisionRequest, VisionResult } from './types';
import { ProviderUnavailableError } from './types';
import { parseObservations, chartDeclaredUnreadable, unreadableObservations, UNREADABLE_CHART_WARNING } from './parse';

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
      'Return a single JSON object.',
      '',
      'First, always include "chart_readable": true or false.',
      'true only if the image is a price chart with visible candles or bars and a readable price axis.',
      'false if it is not a chart, is a sketch or schematic, is too blurry, or is cropped so the price action cannot be read.',
      '',
      'Then, for each key below, return either the value, or',
      'an object {"value": <value|null>, "confidence": 0-1, "pending": boolean, "note": string}.',
      '',
      'Rules you must follow:',
      '- If something is not clearly visible, return null. Never guess.',
      '- "false" is a claim that a structure is definitely absent on a readable chart. If you are unsure, return null, not false.',
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

    let text: string;
    let model: string;
    try {
      ({ text, model } = await generateJson({
        apiKey: this.apiKey,
        models: [this.model, ...geminiFallbackModels()],
        body,
        // Short enough per model that the fallback still gets a turn inside the
        // route's 60-second limit.
        timeoutMs: 26_000,
        budgetMs: 55_000,
      }));
    } catch (error) {
      throw new ProviderUnavailableError(error instanceof Error ? error.message : 'The chart reader failed.', true);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ProviderUnavailableError('The chart reader returned malformed JSON.', true);
    }

    const asOf = new Date().toISOString();

    // The model reports whether the picture is a readable chart; code decides
    // what that means. An explicit "not readable" discards every reading.
    if (chartDeclaredUnreadable(raw)) {
      return {
        observations: unreadableObservations(request.requestedMetrics, asOf),
        providerName: `${this.name} (${model})`,
        warnings: [UNREADABLE_CHART_WARNING],
      };
    }

    const { observations, warnings } = parseObservations(raw, request.requestedMetrics, {
      source: 'vision',
      asOf,
    });
    return { observations, providerName: `${this.name} (${model})`, warnings };
  }
}

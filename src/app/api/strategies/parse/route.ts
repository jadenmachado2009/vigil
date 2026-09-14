import { NextResponse } from 'next/server';
import { getStrategyParser } from '@/lib/strategy-parser';
import { geminiChosenWithoutKey, MISSING_KEY_WARNING } from '@/lib/ai/config';

export const runtime = 'nodejs';

const MAX_LENGTH = 4000;

export async function POST(request: Request) {
  let body: { description?: string; mode?: string; answers?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const description = (body.description ?? '').trim();
  if (!description) return NextResponse.json({ error: 'Describe the strategy first.' }, { status: 400 });
  if (description.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Keep it under ${MAX_LENGTH} characters.` }, { status: 400 });
  }
  const mode = body.mode === 'investing' ? 'investing' : 'trading';
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  const { primary, fallback } = getStrategyParser();
  const warnings: string[] = [];
  if (geminiChosenWithoutKey('STRATEGY_PARSER')) warnings.push(MISSING_KEY_WARNING);
  try {
    const result = await primary.parse({ description, mode, answers });
    return NextResponse.json({ result, warnings });
  } catch (error) {
    // A parser outage must not block strategy creation. The built-in parser
    // still handles most descriptions, and the user reviews everything anyway.
    warnings.push(
      `${error instanceof Error ? error.message : 'The parser failed.'} Fell back to the built-in parser.`,
    );
    const result = await fallback.parse({ description, mode, answers });
    return NextResponse.json({ result, warnings });
  }
}

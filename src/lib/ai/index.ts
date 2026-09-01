import type { VisionProvider } from './types';
import { MockVisionProvider } from './mock-vision';
import { GeminiVisionProvider } from './gemini-vision';

export * from './types';
export { MockVisionProvider } from './mock-vision';
export { GeminiVisionProvider } from './gemini-vision';

/**
 * Chooses the vision provider from the environment. Server-side only.
 *
 * Falls back to the labelled demo reader whenever a real provider is requested
 * but not configured - the app stays usable, and the UI says plainly that the
 * reading is not real.
 */
export function getVisionProvider(): VisionProvider {
  const choice = (process.env['VISION_PROVIDER'] ?? 'mock').toLowerCase();
  if (choice === 'gemini') {
    const key = process.env['GEMINI_API_KEY'];
    if (key) return new GeminiVisionProvider(key);
  }
  return new MockVisionProvider();
}

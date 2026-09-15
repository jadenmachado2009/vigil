/**
 * Client-side image reduction.
 *
 * The chart reader gets the full upload; the journal gets this. A phone
 * screenshot is 2–5 MB and browser storage is 5–10 MB in total, so keeping
 * originals would fill the journal within a handful of entries. 1280px JPEG
 * is legible for "what was on screen" and lands around 150–300 KB.
 */
import type { StoredImage } from '@/types/analysis';

export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.82;

export async function reduceImage(file: Blob, maxEdge = MAX_EDGE): Promise<StoredImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { mimeType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1), width, height };
}

/** Rough decoded size of a stored image, for staying under storage limits. */
export function storedBytes(image: StoredImage): number {
  return Math.floor((image.base64.length * 3) / 4);
}

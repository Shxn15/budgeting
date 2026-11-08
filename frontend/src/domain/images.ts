/**
 * Profile pictures (tags, subscriptions) are stored inside data.json as
 * small square data URLs. The UI scales and crops them before saving
 * (components/avatar/imageProcessing.ts), so one picture is only a few KB
 * and backups always contain the pictures as well.
 */

/** Upper bound for one stored picture (characters of the data URL, ~450 KB). */
export const MAX_IMAGE_LENGTH = 600_000;

const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_IMAGE_LENGTH && DATA_URL.test(value);
}

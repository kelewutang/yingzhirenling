import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const mediaFile = resolve(root, 'data/media.json');
let cachedMedia;

async function loadMediaRecords() {
  cachedMedia ??= readFile(mediaFile, 'utf8').then((contents) => JSON.parse(contents).records);
  return cachedMedia;
}

/**
 * Media is a presentation layer: it is deliberately not folded into Facts,
 * Sources, or the Knowledge Schema. The media validator guarantees that this
 * function can only return a production-eligible local record.
 */
async function getProductionMedia(entityId, usage) {
  const records = await loadMediaRecords();
  const media = records.find((media) => (
    media.entityId === entityId &&
    media.recordState === 'published' &&
    media.usage.includes(usage) &&
    ['permission-recorded', 'official-press-use-reviewed', 'self-captured-reviewed'].includes(media.rightsStatus)
  ));
  return media ? { ...media, src: `/assets/media/${media.src}` } : null;
}

export function getProductionHeroMedia(entityId) {
  return getProductionMedia(entityId, 'hero');
}

export function getProductionCardMedia(entityId) {
  return getProductionMedia(entityId, 'card');
}

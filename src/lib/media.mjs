import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mediaIsConcealed } from './spoilers.mjs';

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
async function getProductionMedia(entityId, usage, entity = null) {
  const records = await loadMediaRecords();
  const media = records.find((media) => (
    media.entityId === entityId &&
    media.recordState === 'published' &&
    media.usage.includes(usage) &&
    ['permission-recorded', 'official-press-use-reviewed', 'self-captured-reviewed', 'official-promotional-risk-accepted'].includes(media.rightsStatus)
  ));
  return media && !mediaIsConcealed(media, entity) ? { ...media, src: `/assets/media/${media.src}` } : null;
}

export function getProductionHeroMedia(entityId, entity = null) {
  return getProductionMedia(entityId, 'hero', entity);
}

export function getProductionCardMedia(entityId, entity = null) {
  return getProductionMedia(entityId, 'card', entity);
}

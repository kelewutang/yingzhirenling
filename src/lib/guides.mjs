import { getCollection } from 'astro:content';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublishedGuides, guideRoute, validateGuides } from './guide-publication.mjs';

let cachedGuides;
const guideBase = process.env.PBZ_GUIDE_CONTENT_DIR || 'src/content/guides';
const guideDirectory = guideBase.startsWith('file:') ? fileURLToPath(guideBase) : resolve(process.cwd(), guideBase);

async function getCollectionOrEmpty() {
  const entries = await readdir(guideDirectory, { withFileTypes: true }).catch(() => []);
  if (!entries.some((entry) => entry.isFile() && entry.name.endsWith('.md'))) return [];
  return getCollection('guides');
}

export async function loadGuides(knowledge) {
  cachedGuides ??= getCollectionOrEmpty();
  const guides = await cachedGuides;
  validateGuides(guides, knowledge);
  return guides;
}

export async function getPublishedGuideEntries(knowledge) {
  return getPublishedGuides(await loadGuides(knowledge));
}

export { guideRoute };

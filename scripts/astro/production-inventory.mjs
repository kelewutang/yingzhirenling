import { shouldConcealSpoiler } from '../../src/lib/spoilers.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STABLE_ROUTES = Object.freeze([
  ['index.html', '/'], ['guide.html', '/guide'], ['weapons.html', '/weapons'],
  ['accessories.html', '/accessories'], ['flasks.html', '/flasks'],
  ['characters.html', '/characters'], ['bosses.html', '/bosses'], ['world.html', '/world'],
  ['videos.html', '/videos'], ['about.html', '/about'], ['about-site.html', '/about-site']
]);
const ENTITY_FAMILIES = Object.freeze([
  ['weapons', 'weapons', 'weapon'], ['characters', 'characters', 'character'],
  ['bosses', 'bosses', 'boss'], ['locations', 'world', 'location'],
  ['accessories', 'accessories', 'accessory'], ['flasks', 'flasks', 'flask']
]);
const COMPATIBILITY_CANONICAL_FILES = 0; // Retired legacy weapon compatibility copies no longer ship.
const NON_CANONICAL_HTML_FILES = 1;

async function readRecords(root, directory) {
  const base = resolve(root, 'data', directory);
  const entries = await readdir(base, { withFileTypes: true });
  return Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).sort((left, right) => left.name.localeCompare(right.name, 'en')).map(async (entry) => JSON.parse(await readFile(resolve(base, entry.name), 'utf8'))));
}

async function readGuideManifest(root) {
  const file = resolve(root, 'generated', 'guide-publication.inventory.json');
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error('Guide publication inventory must be an array');
  return value;
}

export async function loadProductionInventory(root) {
  const [weaponRecords, characterRecords, bossRecords, locationRecords, accessoryRecords, flaskRecords, guides] = await Promise.all([
    readRecords(root, 'weapons'), readRecords(root, 'characters'), readRecords(root, 'bosses'), readRecords(root, 'locations'), readRecords(root, 'accessories'), readRecords(root, 'flasks'), readGuideManifest(root)
  ]);
  const families = [weaponRecords, characterRecords, bossRecords, locationRecords, accessoryRecords, flaskRecords];
  const publishedByType = new Map(ENTITY_FAMILIES.map(([, , type], index) => [type, families[index].filter((item) => item.recordState === 'published')]));
  const draftByType = new Map(ENTITY_FAMILIES.map(([, , type], index) => [type, families[index].filter((item) => item.recordState === 'draft')]));
  const canonicalRoutes = [
    ...STABLE_ROUTES,
    ...ENTITY_FAMILIES.flatMap(([, route, type]) => publishedByType.get(type).map((entity) => [`${route}/${entity.slug}.html`, `/${route}/${entity.slug}`])),
    ...guides.map((guide) => [`guide/${guide.id}.html`, guide.route])
  ];
  const publishedEntities = [...publishedByType.values()].flat();
  return {
    canonicalRoutes,
    guides,
    publishedWeapons: publishedByType.get('weapon'),
    publishedCharacters: publishedByType.get('character'),
    publishedBosses: publishedByType.get('boss'),
    publishedLocations: publishedByType.get('location'),
    publishedAccessories: publishedByType.get('accessory'),
    publishedFlasks: publishedByType.get('flask'),
    draftWeapons: draftByType.get('weapon'),
    draftBosses: draftByType.get('boss'),
    draftLocations: draftByType.get('location'),
    counts: {
      sitemap: canonicalRoutes.length,
      canonical: canonicalRoutes.length + COMPATIBILITY_CANONICAL_FILES,
      pageHtml: canonicalRoutes.length + COMPATIBILITY_CANONICAL_FILES + NON_CANONICAL_HTML_FILES,
      searchDocs: publishedEntities.filter((entity) => !shouldConcealSpoiler(entity)).length + guides.length
    }
  };
}

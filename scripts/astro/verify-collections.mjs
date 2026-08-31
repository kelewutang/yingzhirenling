import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');

async function publishedEntities(directory) {
  const names = (await readdir(resolve(root, directory))).filter((name) => name.endsWith('.json')).sort();
  const entities = await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(root, directory, name), 'utf8'))));
  return entities.filter((entity) => entity.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

const collections = [
  { file: 'weapons.html', directory: 'data/weapons', type: 'weapon', title: '武器', pageTitle: '武器图鉴 - 影之刃零攻略站', route: '/weapons', detailRoute: (entity) => `/weapons/${entity.slug}` },
  { file: 'characters.html', directory: 'data/characters', type: 'character', title: '角色', pageTitle: '角色图鉴 - 影之刃零攻略站', route: '/characters', detailRoute: (entity) => `/characters/${entity.slug}` },
  { file: 'bosses.html', directory: 'data/bosses', type: 'boss', title: 'Boss', pageTitle: 'Boss攻略 - 影之刃零攻略站', route: '/bosses', detailRoute: (entity) => `/bosses/${entity.slug}` },
  { file: 'world.html', directory: 'data/locations', type: 'location', title: '世界', pageTitle: '世界观设定 - 影之刃零攻略站', route: '/world', detailRoute: (entity) => `/world/${entity.slug}` }
];

for (const collection of collections) {
  const entities = await publishedEntities(collection.directory);
  const html = await readFile(resolve(dist, collection.file), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${collection.route}: must have one H1`);
  assert.match(html, new RegExp(`<h1>${collection.title}</h1>`), `${collection.route}: H1 changed`);
  assert(html.includes(`<title>${collection.pageTitle}</title>`), `${collection.route}: title changed`);
  assert(html.includes(`href="https://www.yingzhirenling.cn${collection.route}"`), `${collection.route}: canonical missing`);
  assert(!html.includes('noindex'), `${collection.route}: published collection must be indexable`);
  assert(html.includes('data-collection-system="rollout"'), `${collection.route}: shared collection system missing`);
  assert(html.includes(`data-entity-type="${collection.type}"`), `${collection.route}: type marker missing`);
  assert.equal((html.match(/data-entity-card="true"/g) || []).length, entities.length, `${collection.route}: published card count mismatch`);
  assert.equal((html.match(/data-media-state="fallback"/g) || []).length, entities.length, `${collection.route}: fallback count mismatch`);
  assert.equal((html.match(/<img\b/g) || []).length, 0, `${collection.route}: no production Media record must not emit an image`);
  assert(html.indexOf('class="entity-grid') < html.indexOf('class="collection-supporting"'), `${collection.route}: inventory must precede supporting content`);
  for (const entity of entities) assert(html.includes(`href="${collection.detailRoute(entity)}"`), `${collection.route}: missing card href for ${entity.id}`);
}

const weapons = await publishedEntities('data/weapons');
const draftWeapons = (await Promise.all((await readdir(resolve(root, 'data/weapons'))).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(resolve(root, 'data/weapons', name), 'utf8'))))).filter((entity) => entity.recordState === 'draft');
const weaponCollection = await readFile(resolve(dist, 'weapons.html'), 'utf8');
assert.equal(weapons.length, 8, 'Expected 8 published Weapons');
for (const weapon of draftWeapons) assert(!weaponCollection.includes(`/weapons/${weapon.slug}`), `Draft Weapon must not appear in collection: ${weapon.id}`);

console.log(`Collection verification passed: ${collections.length} collections, ${weapons.length} Weapon, 3 Character, 3 Boss, and 1 Location cards.`);

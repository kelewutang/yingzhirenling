import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const productionRightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'official-promotional-risk-accepted'
]);

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isProductionMedia(record) {
  return record.recordState === 'published' && productionRightsStatuses.has(record.rightsStatus);
}

const mediaRecords = JSON.parse(await readFile(resolve(root, 'data/media.json'), 'utf8')).records;

function getProductionCardMedia(entityId) {
  return mediaRecords.find((record) => isProductionMedia(record) && record.entityId === entityId && record.usage.includes('card')) || null;
}

function assertMediaImage(html, media, location) {
  assert(html.includes(`src="/assets/media/${media.src}"`), `${location}: admitted Media src missing`);
  assert(html.includes(`alt="${escapeHtml(media.alt)}"`), `${location}: admitted Media alt missing`);
  assert(html.includes(`width="${media.width}"`), `${location}: admitted Media intrinsic width missing`);
  assert(html.includes(`height="${media.height}"`), `${location}: admitted Media intrinsic height missing`);
}

async function publishedEntities(directory) {
  const names = (await readdir(resolve(root, directory))).filter((name) => name.endsWith('.json')).sort();
  const entities = await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(root, directory, name), 'utf8'))));
  return entities.filter((entity) => entity.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

const collections = [
  { file: 'weapons.html', directory: 'data/weapons', type: 'weapon', title: '武器', pageTitle: '武器图鉴 - 影之刃零攻略站', route: '/weapons', detailRoute: (entity) => `/weapons/${entity.slug}` },
  { file: 'characters.html', directory: 'data/characters', type: 'character', title: '角色', pageTitle: '角色图鉴 - 影之刃零攻略站', route: '/characters', detailRoute: (entity) => `/characters/${entity.slug}` },
  { file: 'bosses.html', directory: 'data/bosses', type: 'boss', title: 'Boss资料', pageTitle: 'Boss资料 - 影之刃零攻略站', route: '/bosses', detailRoute: (entity) => `/bosses/${entity.slug}` },
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
  const expectedCardMedia = entities.map((entity) => [entity, getProductionCardMedia(entity.id)]);
  const cardMediaFigures = [...html.matchAll(/<figure class="entity-media entity-media--card"[\s\S]*?<\/figure>/g)];
  assert.equal((html.match(/data-media-state="fallback"/g) || []).length, expectedCardMedia.filter(([, media]) => !media).length, `${collection.route}: fallback count must match Entities without admitted card Media`);
  assert.equal(cardMediaFigures.reduce((count, figure) => count + (figure[0].match(/<img\b/g) || []).length, 0), expectedCardMedia.filter(([, media]) => media).length, `${collection.route}: card image count must match admitted card Media`);
  assert.equal(cardMediaFigures.length, entities.length, `${collection.route}: every card must use card Media mode`);
  for (const [entity, media] of expectedCardMedia) {
    if (media) assertMediaImage(html, media, `${collection.route}: ${entity.id}`);
  }
  for (const figure of cardMediaFigures) {
    assert(!figure[0].includes('<a '), `${collection.route}: card Media must not contain a nested source anchor`);
  }
  assert(html.indexOf('class="entity-grid') < html.indexOf('class="collection-supporting"'), `${collection.route}: inventory must precede supporting content`);
  for (const entity of entities) assert(html.includes(`href="${collection.detailRoute(entity)}"`), `${collection.route}: missing card href for ${entity.id}`);
}

const weapons = await publishedEntities('data/weapons');
const draftWeapons = (await Promise.all((await readdir(resolve(root, 'data/weapons'))).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(resolve(root, 'data/weapons', name), 'utf8'))))).filter((entity) => entity.recordState === 'draft');
const weaponCollection = await readFile(resolve(dist, 'weapons.html'), 'utf8');
assert.equal(weapons.length, 15, 'Expected 15 published Weapons after the approved release update');
for (const weapon of draftWeapons) assert(!weaponCollection.includes(`/weapons/${weapon.slug}`), `Draft Weapon must not appear in collection: ${weapon.id}`);

const search = JSON.parse(await readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'));
for (const [slug, chinese, english] of [
  ['jagged-steel', '残钢刃', 'Jagged Steel'],
  ['soft-snake-sword', '灵蛇软剑', 'Soft Snake Sword']
]) {
  const card = weaponCollection.match(new RegExp(`<a class="entity-card" href="/weapons/${slug}"[\\s\\S]*?</a>`))?.[0] || '';
  const detail = await readFile(resolve(dist, `weapons/${slug}.html`), 'utf8');
  const document = search.find((item) => item.id === `weapon:${slug}`);
  assert(card.includes(`<h3 class="entity-card__title">${chinese}</h3>`) && card.includes(english), `${slug}: bilingual collection name missing`);
  assert(detail.includes(`<h1 class="entity-hero__title">${chinese}</h1>`) && detail.includes(`<p class="entity-hero__aliases">${english}</p>`), `${slug}: bilingual detail name missing`);
  assert.equal(document?.route, `/weapons/${slug}`, `${slug}: original Search URL changed`);
  assert.equal(document?.displayName, chinese, `${slug}: Chinese Search title missing`);
  assert(document?.aliases.includes(english), `${slug}: English Search alias missing`);
}
for (const slug of ['hongzhuang-guizhan']) {
  assert(!weaponCollection.includes(`/weapons/${slug}`), `${slug}: unpublished Weapon entered collection`);
  assert(!search.some((item) => item.route === `/weapons/${slug}`), `${slug}: unpublished Weapon entered Search`);
}
for (const slug of ['cangang', 'peng-meng', 'hua-qianxiao']) {
  assert(!search.some((item) => item.route === `/bosses/${slug}`), `${slug}: unpublished Boss entered Search`);
}
const blackBlades = JSON.parse(await readFile(resolve(root, 'data/weapons/heishang-shuangren.json'), 'utf8'));
assert.equal(blackBlades.displayName, '黑伤双刃', 'Black Blades must use the correct simplified Chinese character');
assert(weaponCollection.includes('/weapons/heishang-shuangren'), 'Approved Black Blades must enter the collection');
assert.equal(search.filter((item) => item.id === blackBlades.id).length, 1, 'Reused Black Blades identity must have exactly one Search document');

const brokenBlade = await readFile(resolve(dist, 'weapons/chizhe-canjian.html'), 'utf8');
const brokenBladeCard = weaponCollection.match(/<a class="entity-card" href="\/weapons\/chizhe-canjian"[\s\S]*?<\/a>/)?.[0] || '';
const brokenBladeSearch = search.filter((item) => item.id === 'weapon:chizhe-canjian');
assert(brokenBladeCard.includes('痴者残剑') && brokenBladeCard.includes('The Fanatic&#39;s Broken Blade'), 'Broken Blade bilingual collection card missing');
assert(brokenBlade.includes('<h1 class="entity-hero__title">痴者残剑</h1>'), 'Broken Blade detail H1 missing');
for (const factId of ['acquisition', 'drink-sha-chi', 'flying-swords']) {
  assert(brokenBlade.includes(`data-fact-id="fact:weapon:chizhe-canjian:${factId}"`), `Broken Blade independent Fact missing: ${factId}`);
}
assert(brokenBlade.includes('本页来源') && brokenBlade.includes('A9VG电玩部落') && brokenBlade.includes('4Gamer.net'), 'Broken Blade sources missing');
assert.equal(brokenBladeSearch.length, 1, 'Broken Blade must have one Search result');
assert.equal(brokenBladeSearch[0].route, '/weapons/chizhe-canjian', 'Broken Blade Search route changed');
assert(brokenBladeSearch[0].aliases.includes("The Fanatic's Broken Blade"), 'Broken Blade English alias missing from Search');

console.log(`Collection verification passed: ${collections.length} collections, ${weapons.length} Weapon, 3 Character, 3 Boss, and 1 Location cards.`);

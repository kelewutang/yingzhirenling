import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
async function readEntities(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
}
const weapons = await readEntities('data/weapons');
const publishedWeapons = weapons.filter((weapon) => weapon.recordState === 'published');
const draftWeapons = weapons.filter((weapon) => weapon.recordState === 'draft');
const characters = await readEntities('data/characters');
const publishedCharacters = characters.filter((character) => character.recordState === 'published');
const bosses = await readEntities('data/bosses');
const publishedBosses = bosses.filter((boss) => boss.recordState === 'published');
const draftBosses = bosses.filter((boss) => boss.recordState === 'draft');
const locations = await readEntities('data/locations');
const publishedLocations = locations.filter((location) => location.recordState === 'published');
const draftLocations = locations.filter((location) => location.recordState === 'draft');
const canonicalRoutes = [
  ['index.html', '/'], ['guide.html', '/guide'], ['weapons.html', '/weapons'],
  ['characters.html', '/characters'], ['bosses.html', '/bosses'], ['world.html', '/world'],
  ['videos.html', '/videos'], ['about.html', '/about'], ['about-site.html', '/about-site'],
  ...publishedWeapons.map((weapon) => [`weapons/${weapon.slug}.html`, `/weapons/${weapon.slug}`]),
  ['characters/soul.html', '/characters/soul'],
  ['characters/mo-yuan.html', '/characters/mo-yuan'],
  ['characters/the-hunt.html', '/characters/the-hunt'],
  ...publishedBosses.map((boss) => [`bosses/${boss.slug}.html`, `/bosses/${boss.slug}`]),
  ...publishedLocations.map((location) => [`world/${location.slug}.html`, `/world/${location.slug}`])
];

async function assertDetailVisualContract(file, entityType) {
  const html = await readFile(resolve(dist, file), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: detail page must have one H1`);
  assert(html.includes('data-detail-system="rollout"'), `${file}: shared detail system missing`);
  assert(html.includes(`data-entity-type="${entityType}"`), `${file}: entity type marker missing`);
  assert(html.includes('class="entity-hero"'), `${file}: Entity Hero missing`);
  assert(html.includes('data-media-state="fallback"'), `${file}: production no-media fallback missing`);
  assert(!html.includes('<img'), `${file}: no Media record must not emit an image`);
}

for (const [file] of canonicalRoutes) assert((await stat(resolve(dist, file))).isFile(), `Missing dist/${file}`);
assert((await stat(resolve(dist, '404.html'))).isFile(), 'Missing custom 404');
if (process.env.CONTEXT === 'deploy-preview') {
  assert.match(await readFile(resolve(dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
} else {
  await assert.rejects(() => stat(resolve(dist, '_headers')), { code: 'ENOENT' });
}

const homepage = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.equal((homepage.match(/<h1\b/g) || []).length, 1, 'Homepage must have one H1');
assert(homepage.includes('<link rel="canonical" href="https://www.yingzhirenling.cn/"'), 'Homepage canonical missing');
assert(homepage.includes('data-home-search-trigger'), 'Homepage primary Search trigger missing');
assert(!homepage.includes('noindex'), 'Homepage must be indexable');
assert(homepage.includes('class="footer site-footer"'), 'Homepage shared footer missing');
assert(!homepage.includes('qinglong-lueyue-dao') && !homepage.includes('青龙掠月刀'), 'Homepage must exclude draft Qinglong');
assert(!homepage.includes('JSON.stringify'), 'Homepage must not emit a literal JSON.stringify expression');
const homepageJsonLd = [...homepage.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.equal(homepageJsonLd.length, 1, 'Homepage must render one WebSite JSON-LD script');
const homepageStructuredData = JSON.parse(homepageJsonLd[0][1]);
assert.equal(homepageStructuredData['@context'], 'https://schema.org', 'Homepage JSON-LD context must be schema.org');
assert.equal(homepageStructuredData['@type'], 'WebSite', 'Homepage JSON-LD type must be WebSite');
const homepageCategoryAssertions = [
  ['/weapons', '武器', publishedWeapons.length],
  ['/characters', '角色', publishedCharacters.length],
  ['/bosses', 'Boss', publishedBosses.length],
  ['/world', '世界', publishedLocations.length]
];
for (const [route, label, count] of homepageCategoryAssertions) {
  assert(homepage.includes(`href="${route}"`), `Homepage category link missing: ${route}`);
  assert(homepage.includes(`<strong>${count}</strong> 个已发布条目`), `Homepage published count missing: ${label}`);
}

for (const slug of ['tang-hengdao', 'ya-hengdao']) {
  const candidate = await readFile(resolve(dist, 'weapons', `${slug}.html`), 'utf8');
  const legacy = await readFile(resolve(root, 'pages/generated/weapons', `${slug}.html`), 'utf8');
  const canonical = `https://www.yingzhirenling.cn/weapons/${slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回武器图鉴']) {
    assert(candidate.includes(token), `${slug}: missing static contract token ${token}`);
  }
  const candidateFacts = [...candidate.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]).sort();
  const legacyFacts = [...legacy.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(candidateFacts, legacyFacts, `${slug}: Fact projection differs from production`);
  const contracts = [
    /<title>([^<]+)<\/title>/,
    /<meta name="description" content="([^"]+)"/,
    /<link rel="canonical" href="([^"]+)"/,
    /<h1[^>]*>([^<]+)<\/h1>/
  ];
  for (const contract of contracts) {
    assert.equal(candidate.match(contract)?.[1], legacy.match(contract)?.[1], `${slug}: SEO semantic parity failed: ${contract}`);
  }
  const candidateStatuses = [...candidate.matchAll(/class="info-status" data-status="([^"]+)"/g)].map((match) => match[1]).sort();
  const legacyStatuses = [...legacy.matchAll(/class="info-status" data-status="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(candidateStatuses, legacyStatuses, `${slug}: status label projection differs from production`);
  const sourceUrls = [...legacy.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of sourceUrls) assert(candidate.includes(`href="${url}"`), `${slug}: Source link missing: ${url}`);
  for (const wording of ['待后续核查', '本站发售前编辑判断，不是官方评分或试玩客观数值。', '获取方式尚待后续官方资料或正式版验证。']) {
    assert.equal(candidate.includes(wording), legacy.includes(wording), `${slug}: wording parity failed: ${wording}`);
  }
}

for (const path of [
  'weapons/not-real.html',
  'characters/not-real.html',
  'bosses/not-real.html',
  'world/not-real.html',
  ...draftWeapons.map((weapon) => `weapons/${weapon.slug}.html`),
  ...draftBosses.map((boss) => `bosses/${boss.slug}.html`),
  ...draftLocations.map((location) => `world/${location.slug}.html`)
]) {
  await assert.rejects(() => stat(resolve(dist, path)), { code: 'ENOENT' });
}

for (const weapon of publishedWeapons) {
  const html = await readFile(resolve(dist, 'weapons', `${weapon.slug}.html`), 'utf8');
  await assertDetailVisualContract(`weapons/${weapon.slug}.html`, 'weapon');
  const canonical = `https://www.yingzhirenling.cn/weapons/${weapon.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回武器图鉴']) {
    assert(html.includes(token), `${weapon.slug}: missing static Weapon contract token ${token}`);
  }
  assert(html.includes(escapeHtml(weapon.summary)), `${weapon.slug}: summary missing from static Weapon page`);
  assert(!html.includes('noindex'), `${weapon.slug}: published Weapon must be indexable`);
}
const weaponCollection = await readFile(resolve(dist, 'weapons.html'), 'utf8');
for (const weapon of publishedWeapons) assert(weaponCollection.includes(`href="/weapons/${weapon.slug}"`), `Weapon collection missing ${weapon.slug}`);
for (const weapon of draftWeapons) assert(!weaponCollection.includes(`href="/weapons/${weapon.slug}"`), `Weapon collection must exclude draft ${weapon.slug}`);

for (const slug of ['soul', 'mo-yuan', 'the-hunt']) {
  const html = await readFile(resolve(dist, 'characters', `${slug}.html`), 'utf8');
  await assertDetailVisualContract(`characters/${slug}.html`, 'character');
  const canonical = `https://www.yingzhirenling.cn/characters/${slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回角色图鉴']) {
    assert(html.includes(token), `${slug}: missing static Character contract token ${token}`);
  }
  assert(!html.includes('noindex'), `${slug}: published Character must be indexable`);
}
const soul = await readFile(resolve(dist, 'characters/soul.html'), 'utf8');
assert.equal((soul.match(/data-relation-id=/g) || []).length, 2, 'Soul must render two unique Relations');
for (const wording of ['魔渊', '父亲', 'The Hunt', '曾经的同伴']) assert(soul.includes(wording), `Soul Relation presentation missing: ${wording}`);
const hunt = await readFile(resolve(dist, 'characters/the-hunt.html'), 'utf8');
assert(!hunt.includes('猎杀'), 'The Hunt must not gain an invented Chinese name');

const collection = await readFile(resolve(dist, 'characters.html'), 'utf8');
for (const slug of ['soul', 'mo-yuan', 'the-hunt']) assert(collection.includes(`href="/characters/${slug}"`), `Character collection missing ${slug}`);

for (const boss of publishedBosses) {
  const html = await readFile(resolve(dist, 'bosses', `${boss.slug}.html`), 'utf8');
  await assertDetailVisualContract(`bosses/${boss.slug}.html`, 'boss');
  const canonical = `https://www.yingzhirenling.cn/bosses/${boss.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回 Boss 图鉴']) {
    assert(html.includes(token), `${boss.slug}: missing static Boss contract token ${token}`);
  }
  assert(html.includes(boss.summary), `${boss.slug}: summary missing from static Boss page`);
  assert(!html.includes('noindex'), `${boss.slug}: published Boss must be indexable`);
}
const bossCollection = await readFile(resolve(dist, 'bosses.html'), 'utf8');
for (const boss of publishedBosses) assert(bossCollection.includes(`href="/bosses/${boss.slug}"`), `Boss collection missing ${boss.slug}`);
for (const boss of draftBosses) assert(!bossCollection.includes(`/bosses/${boss.slug}`), `Boss collection must exclude draft ${boss.slug}`);

for (const location of publishedLocations) {
  const html = await readFile(resolve(dist, 'world', `${location.slug}.html`), 'utf8');
  await assertDetailVisualContract(`world/${location.slug}.html`, 'location');
  const canonical = `https://www.yingzhirenling.cn/world/${location.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回世界与地点']) {
    assert(html.includes(token), `${location.slug}: missing static Location contract token ${token}`);
  }
  assert(html.includes(escapeHtml(location.summary)), `${location.slug}: summary missing from static Location page`);
  assert(!html.includes('noindex'), `${location.slug}: published Location must be indexable`);
}
const locationCollection = await readFile(resolve(dist, 'world.html'), 'utf8');
for (const location of publishedLocations) assert(locationCollection.includes(`href="/world/${location.slug}"`), `Location collection missing ${location.slug}`);
for (const location of draftLocations) assert(!locationCollection.includes(`href="/world/${location.slug}"`), `Location collection must exclude draft ${location.slug}`);

const search = JSON.parse(await readFile(resolve(dist, 'generated/search-index.production.json'), 'utf8'));
assert.deepEqual(search.map((item) => item.id), [
  ...publishedBosses.map((boss) => boss.id),
  ...publishedWeapons.map((weapon) => weapon.id),
  ...publishedLocations.map((location) => location.id),
  'character:mo-yuan', 'character:soul', 'character:the-hunt'
].sort());
for (const document of search.filter((item) => item.entityType === 'character')) assert.equal(document.route, `/characters/${document.slug}`);
const weaponDocuments = search.filter((item) => item.entityType === 'weapon');
assert.equal(weaponDocuments.length, publishedWeapons.length, 'Production Search Weapon count must match published Weapon data');
for (const weapon of publishedWeapons) {
  const document = weaponDocuments.find((item) => item.id === weapon.id);
  assert(document, `Production Search missing ${weapon.id}`);
  assert.equal(document.route, `/weapons/${weapon.slug}`, `${weapon.id}: Search route must be canonical`);
}
for (const weapon of draftWeapons) assert(!search.some((item) => item.id === weapon.id), `Production Search must exclude draft ${weapon.id}`);
const bossDocuments = search.filter((item) => item.entityType === 'boss');
assert.equal(bossDocuments.length, publishedBosses.length, 'Production Search Boss count must match published Boss data');
for (const boss of publishedBosses) {
  const document = bossDocuments.find((item) => item.id === boss.id);
  assert(document, `Production Search missing ${boss.id}`);
  assert.equal(document.route, `/bosses/${boss.slug}`, `${boss.id}: Search route must be canonical`);
}
for (const boss of draftBosses) assert(!search.some((item) => item.id === boss.id), `Production Search must exclude draft ${boss.id}`);
const locationDocuments = search.filter((item) => item.entityType === 'location');
assert.equal(locationDocuments.length, publishedLocations.length, 'Production Search Location count must match published Location data');
for (const location of publishedLocations) {
  const document = locationDocuments.find((item) => item.id === location.id);
  assert(document, `Production Search missing ${location.id}`);
  assert.equal(document.route, `/world/${location.slug}`, `${location.id}: Search route must be canonical`);
}
for (const location of draftLocations) assert(!search.some((item) => item.id === location.id), `Production Search must exclude draft ${location.id}`);
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
assert.equal(
  (sitemap.match(/<url>/g) || []).length,
  9 + publishedWeapons.length + 3 + publishedBosses.length + publishedLocations.length,
  'Sitemap URL count must match published Entity data'
);
for (const weapon of publishedWeapons) assert(sitemap.includes(`/weapons/${weapon.slug}`), `Sitemap missing Weapon ${weapon.slug}`);
for (const weapon of draftWeapons) assert(!sitemap.includes(`/weapons/${weapon.slug}`), `Sitemap must exclude draft Weapon ${weapon.slug}`);
for (const route of ['/characters/soul', '/characters/mo-yuan', '/characters/the-hunt']) assert(sitemap.includes(route), `Sitemap missing ${route}`);
for (const boss of publishedBosses) assert(sitemap.includes(`/bosses/${boss.slug}`), `Sitemap missing Boss ${boss.slug}`);
for (const boss of draftBosses) assert(!sitemap.includes(`/bosses/${boss.slug}`), `Sitemap must exclude draft Boss ${boss.slug}`);
for (const location of publishedLocations) assert(sitemap.includes(`/world/${location.slug}`), `Sitemap missing Location ${location.slug}`);
for (const location of draftLocations) assert(!sitemap.includes(`/world/${location.slug}`), `Sitemap must exclude draft Location ${location.slug}`);
assert.equal((await readdir(dist)).includes('_astro'), false, 'Unexpected Astro client assets');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
for (const file of await walk(dist)) {
  const content = await readFile(file);
  const text = content.toString('utf8');
  for (const forbidden of ['/home/mok', '/mnt/c/', 'astro-island', 'client:load']) assert(!text.includes(forbidden), `${file}: forbidden build output`);
}
console.log(`Astro dist verification passed: ${canonicalRoutes.length} canonical routes, ${publishedWeapons.length} Weapon pages, 3 Character pages, ${publishedBosses.length} Boss pages, ${publishedLocations.length} Location pages, ${draftWeapons.length} draft Weapon, ${draftBosses.length} draft Boss, and ${draftLocations.length} draft Location detail routes.`);

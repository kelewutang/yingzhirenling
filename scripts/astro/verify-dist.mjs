import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
async function readEntities(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
}
const bosses = await readEntities('data/bosses');
const publishedBosses = bosses.filter((boss) => boss.recordState === 'published');
const draftBosses = bosses.filter((boss) => boss.recordState === 'draft');
const canonicalRoutes = [
  ['index.html', '/'], ['guide.html', '/guide'], ['weapons.html', '/weapons'],
  ['characters.html', '/characters'], ['bosses.html', '/bosses'], ['world.html', '/world'],
  ['videos.html', '/videos'], ['about.html', '/about'], ['about-site.html', '/about-site'],
  ['weapons/tang-hengdao.html', '/weapons/tang-hengdao'],
  ['weapons/ya-hengdao.html', '/weapons/ya-hengdao'],
  ['characters/soul.html', '/characters/soul'],
  ['characters/mo-yuan.html', '/characters/mo-yuan'],
  ['characters/the-hunt.html', '/characters/the-hunt'],
  ...publishedBosses.map((boss) => [`bosses/${boss.slug}.html`, `/bosses/${boss.slug}`])
];

for (const [file] of canonicalRoutes) assert((await stat(resolve(dist, file))).isFile(), `Missing dist/${file}`);
assert((await stat(resolve(dist, '404.html'))).isFile(), 'Missing custom 404');
if (process.env.CONTEXT === 'deploy-preview') {
  assert.match(await readFile(resolve(dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
} else {
  await assert.rejects(() => stat(resolve(dist, '_headers')), { code: 'ENOENT' });
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

for (const path of ['weapons/qinglong-lueyue-dao.html', 'characters/not-real.html', ...draftBosses.map((boss) => `bosses/${boss.slug}.html`)]) {
  await assert.rejects(() => stat(resolve(dist, path)), { code: 'ENOENT' });
}

for (const slug of ['soul', 'mo-yuan', 'the-hunt']) {
  const html = await readFile(resolve(dist, 'characters', `${slug}.html`), 'utf8');
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

const search = JSON.parse(await readFile(resolve(dist, 'generated/search-index.production.json'), 'utf8'));
assert.deepEqual(search.map((item) => item.id), [
  ...publishedBosses.map((boss) => boss.id),
  'character:mo-yuan', 'character:soul', 'character:the-hunt', 'weapon:tang-hengdao', 'weapon:ya-hengdao'
].sort());
for (const document of search.filter((item) => item.entityType === 'character')) assert.equal(document.route, `/characters/${document.slug}`);
const bossDocuments = search.filter((item) => item.entityType === 'boss');
assert.equal(bossDocuments.length, publishedBosses.length, 'Production Search Boss count must match published Boss data');
for (const boss of publishedBosses) {
  const document = bossDocuments.find((item) => item.id === boss.id);
  assert(document, `Production Search missing ${boss.id}`);
  assert.equal(document.route, `/bosses/${boss.slug}`, `${boss.id}: Search route must be canonical`);
}
for (const boss of draftBosses) assert(!search.some((item) => item.id === boss.id), `Production Search must exclude draft ${boss.id}`);
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<url>/g) || []).length, 14 + publishedBosses.length, 'Sitemap URL count must include published Bosses only');
for (const route of ['/characters/soul', '/characters/mo-yuan', '/characters/the-hunt']) assert(sitemap.includes(route), `Sitemap missing ${route}`);
for (const boss of publishedBosses) assert(sitemap.includes(`/bosses/${boss.slug}`), `Sitemap missing Boss ${boss.slug}`);
for (const boss of draftBosses) assert(!sitemap.includes(`/bosses/${boss.slug}`), `Sitemap must exclude draft Boss ${boss.slug}`);
assert(!sitemap.includes('qinglong-lueyue-dao'));
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
console.log(`Astro dist verification passed: ${canonicalRoutes.length} canonical routes, 2 Weapon pages, 3 Character pages, ${publishedBosses.length} Boss pages, ${draftBosses.length} draft Boss detail routes.`);

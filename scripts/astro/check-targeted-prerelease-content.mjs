import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadProductionInventory } from './production-inventory.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const guideId = 'difficulty-and-sixty-six-days';
const guideRoute = `/guide/${guideId}`;
const sourceId = 'source:official-bilibili-producer-2026-09-09-difficulty-weapons-players';
const expectedDifficulties = [
  ['difficulty:wayfarer', '入阵者'],
  ['difficulty:pathbreaker', '破局者'],
  ['difficulty:hellwalker', '逆天者'],
  ['difficulty:sixty-six-days', '六十六天']
];

const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), 'utf8'));
const absent = async (file) => stat(file).then(() => false, (error) => error.code === 'ENOENT' ? true : Promise.reject(error));

const [source, registry, weapon, guideSource, guideInventory, search, inventory, guideHtml, landingHtml, weaponHtml, aboutHtml, sitemap, launchConfig, distFiles] = await Promise.all([
  readJson('data/sources/official-bilibili-producer-2026-09-09-difficulty-weapons-players.json'),
  readJson('data/registries/difficulties.json'),
  readJson('data/weapons/white-shadow.json'),
  readFile(resolve(root, 'src/content/guides', `${guideId}.md`), 'utf8'),
  readJson('generated/guide-publication.inventory.json'),
  readJson('generated/search-index.production.json'),
  loadProductionInventory(root),
  readFile(resolve(dist, 'guide', `${guideId}.html`), 'utf8'),
  readFile(resolve(dist, 'guide.html'), 'utf8'),
  readFile(resolve(dist, 'weapons/white-shadow.html'), 'utf8'),
  readFile(resolve(dist, 'about.html'), 'utf8'),
  readFile(resolve(dist, 'sitemap.xml'), 'utf8'),
  readJson('config/launch-operations.json'),
  readdir(dist, { recursive: true })
]);

assert.deepEqual([source.id, source.authority, source.sourceType, source.publisher, source.title, source.publishedAt, source.checkedAt, source.url], [
  sourceId, 'official', 'official-article', '制作人 Soulframe', '《难度，武器，玩家》', '2026-09-09', '2026-10-06', 'https://www.bilibili.com/opus/1246026555841314820'
]);
assert.deepEqual(registry.difficulties.map(({ id, displayName }) => [id, displayName]), expectedDifficulties, 'Difficulty registry must contain exactly the four official entries');

assert.match(guideSource, /spoilerLevel: "none"/);
assert.match(guideSource, /status: "published"/);
assert.match(guideSource, /guideType: "system"/);
assert.match(guideSource, /publishedAt: "2026-10-06"/);
assert.match(guideSource, /updatedAt: "2026-10-06"/);
assert(!/^ {0,3}#(?!#)\s+\S/m.test(guideSource.split('---').slice(2).join('---')), 'Guide Markdown must not own an H1');
for (const [id, name] of expectedDifficulties) {
  assert(guideSource.includes(`- "${id}"`), `Guide must reference ${id}`);
  assert(guideHtml.includes(name), `Guide detail must render ${name}`);
}
for (const excluded of ['饮恨江湖', '最终 Boss', '隐藏 Boss', '游戏靠后流程', '左殇']) {
  assert(!guideSource.includes(excluded), `Guide must exclude ${excluded}`);
}
assert(!guideSource.includes('gameVersionId:'), 'Guide must not claim a release Version');
assert.equal(guideInventory.length, 1, 'Exactly one production Guide must be published');
assert.deepEqual(guideInventory.map(({ id, route, spoilerLevel, recordState }) => ({ id, route, spoilerLevel, recordState })), [
  { id: guideId, route: guideRoute, spoilerLevel: 'none', recordState: 'published' }
]);

assert.equal((guideHtml.match(/<h1\b/g) || []).length, 1, 'Guide detail must render exactly one H1');
assert(guideHtml.includes(`<link rel="canonical" href="https://www.yingzhirenling.cn${guideRoute}"`), 'Guide canonical missing');
assert(guideHtml.includes('"@type":"Article"'), 'Guide Article structured data missing');
assert(guideHtml.includes('"@type":"BreadcrumbList"'), 'Guide Breadcrumb structured data missing');
assert(guideHtml.includes(source.url), 'Guide official source link missing');
assert(!guideHtml.includes('data-spoiler-level="major"') && !guideHtml.includes('含部分剧情信息'), 'spoilerLevel=none Guide must not render a spoiler disclosure');
assert(!guideHtml.includes('data-collection-browser'), 'Guide must not render Collection Browser UI');
assert(landingHtml.includes(`href="${guideRoute}"`), 'Guide landing must link to the published Guide');
for (const currentName of expectedDifficulties.map(([, name]) => name)) assert(landingHtml.includes(currentName), `/guide must render ${currentName}`);
for (const obsolete of ['旅人模式', '破路者模式', '地狱行者模式']) assert(!landingHtml.includes(obsolete), `/guide must not present ${obsolete} as current terminology`);

const oldType = weapon.facts.find((fact) => fact.id === 'fact:weapon:white-shadow:weapon-type');
const currentType = weapon.facts.find((fact) => fact.id === 'fact:weapon:white-shadow:weapon-type-official');
assert.equal(oldType?.value, '双手剑', 'Historical White Shadow Fact must remain intact');
assert.equal(oldType?.supersededBy, currentType?.id, 'Historical White Shadow Fact must point to its successor');
assert.deepEqual([currentType?.value, currentType?.status, currentType?.sourceIds, currentType?.supersededBy], ['苗刀', 'official', [sourceId], null]);
assert(weaponHtml.includes('主武器 · 苗刀'), 'White Shadow public detail must render 苗刀');
assert(!weaponHtml.includes('主武器 · 双手剑'), 'White Shadow public detail must not render 双手剑 as current taxonomy');
const whiteShadowSearch = search.find((document) => document.id === 'weapon:white-shadow');
assert(whiteShadowSearch?.keywords.includes('苗刀'), 'White Shadow Search document must include current type 苗刀');
assert(!whiteShadowSearch?.keywords.includes('双手剑'), 'White Shadow Search document must exclude superseded type 双手剑');

for (const text of ['PS5 Pro 增强', '游戏帮助', '自适应扳机', '触觉反馈', 'Tempest 3D 音效技术']) assert(aboutHtml.includes(text), `/about missing ${text}`);
assert(aboutHtml.includes('https://www.playstation.com/zh-hans-cn/games/phantom-blade-zero/'), '/about PS5 facts must link to the official PlayStation China page');
assert(!aboutHtml.includes('影之刃零支持手动存档'), '/about must not make a broad manual-save claim');

const guideDocuments = search.filter((document) => document.documentType === 'guide');
assert.equal(search.length, 17, 'Production Search must contain 17 documents');
assert.equal(guideDocuments.length, 1, 'Production Search must contain one Guide document');
assert.deepEqual([guideDocuments[0].id, guideDocuments[0].route, guideDocuments[0].recordState], [`guide:${guideId}`, guideRoute, 'published']);
assert.equal((sitemap.match(/<url>/g) || []).length, 26, 'Sitemap must contain 26 URLs');
assert(sitemap.includes(`<loc>https://www.yingzhirenling.cn${guideRoute}</loc><lastmod>2026-10-06</lastmod>`), 'Guide sitemap entry missing or stale');
assert.deepEqual(inventory.counts, { sitemap: 26, canonical: 28, pageHtml: 29, searchDocs: 17 });
assert.deepEqual([
  inventory.publishedWeapons.length,
  inventory.publishedBosses.length,
  inventory.publishedCharacters.length,
  inventory.publishedLocations.length,
  inventory.guides.length
], [9, 3, 3, 1, 1]);

const canonicalTagCount = (await Promise.all(distFiles.filter((file) => file.endsWith('.html')).map((file) => readFile(resolve(dist, file), 'utf8'))))
  .reduce((count, html) => count + (html.match(/<link\s+rel="canonical"\s+href="/gi) || []).length, 0);
const pageHtmlCount = distFiles.filter((file) => file.endsWith('.html') && !file.startsWith('baidu_verify_')).length;
assert.equal(canonicalTagCount, 28, 'Rendered canonical-tag count must be 28');
assert.equal(pageHtmlCount, 29, 'Rendered page-HTML count must be 29');

assert.equal(await absent(resolve(dist, 'generated/guide-search-manifest.json')), true, 'Private Guide handoff manifest must not be deployed');
assert.doesNotMatch([landingHtml, sitemap, JSON.stringify(search), ...distFiles].join('\n'), /growth-guide-[a-f]/, 'Synthetic growth fixtures must not leak into production landing, sitemap, Search or files');
for (const fixtureRoute of ['published-guide', 'story-guide-01', 'draft-guide']) {
  assert.equal(await absent(resolve(dist, 'guide', `${fixtureRoute}.html`)), true, `Fixture route ${fixtureRoute} must remain absent`);
}
for (const gate of Object.values(launchConfig.browserGates)) assert.deepEqual(gate, { contractVersion: 1, status: 'deferred', approvedAt: null, evidenceRef: null });

console.log('Targeted pre-release content verification passed: official source, four difficulties, one Guide, White Shadow supersession, PS5 facts, 26/28/29/17 inventory, and private fixture isolation.');

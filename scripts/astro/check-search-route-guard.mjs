import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { resolvePublishedCharacterDetailPageSlugs, resolvePublishedLocationDetailPageSlugs, resolvePublishedWeaponDetailPageSlugs } from '../build-search-index.mjs';

const records = [{ file: 'fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'weapon', id: 'weapon:fixture', slug: 'fixture',
  displayName: 'Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
} }];
const characterRecords = [{ file: 'character-fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'character', id: 'character:fixture', slug: 'fixture-character',
  displayName: 'Character Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
} }];
const locationRecords = [{ file: 'location-fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'location', id: 'location:fixture', slug: 'fixture-location',
  displayName: 'Location Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
} }];
const directory = await mkdtemp(join(tmpdir(), 'p1-10-route-guard-'));
try {
  await assert.rejects(() => resolvePublishedWeaponDetailPageSlugs(records, directory, false), /缺少详情页/);
  await writeFile(join(directory, 'fixture.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/wrong">');
  await assert.rejects(() => resolvePublishedWeaponDetailPageSlugs(records, directory, false), /canonical/);
  await writeFile(join(directory, 'fixture.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/fixture">');
  assert.deepEqual([...await resolvePublishedWeaponDetailPageSlugs(records, directory, false)], ['fixture']);
  await assert.rejects(() => resolvePublishedCharacterDetailPageSlugs(characterRecords, directory), /缺少详情页/);
  await writeFile(join(directory, 'fixture-character.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/characters/wrong">');
  await assert.rejects(() => resolvePublishedCharacterDetailPageSlugs(characterRecords, directory), /canonical/);
  await writeFile(join(directory, 'fixture-character.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/characters/fixture-character">');
  assert.deepEqual([...await resolvePublishedCharacterDetailPageSlugs(characterRecords, directory)], ['fixture-character']);
  await assert.rejects(() => resolvePublishedLocationDetailPageSlugs(locationRecords, directory), /缺少详情页/);
  await writeFile(join(directory, 'fixture-location.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/world/wrong">');
  await assert.rejects(() => resolvePublishedLocationDetailPageSlugs(locationRecords, directory), /canonical/);
  await writeFile(join(directory, 'fixture-location.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/world/fixture-location">');
  assert.deepEqual([...await resolvePublishedLocationDetailPageSlugs(locationRecords, directory)], ['fixture-location']);
  console.log('Astro Search route guard fixtures passed.');
} finally {
  await rm(directory, { recursive: true, force: true });
}

const mainJs = await readFile(join(import.meta.dirname, '../../js/main.js'), 'utf8');
const pageSearchSource = mainJs.slice(mainJs.indexOf('var SEARCH_INDEX'), mainJs.indexOf('function refreshCurrentSearch()'));
const pageSearchContext = {};
vm.runInNewContext(pageSearchSource, pageSearchContext);

assert.ok(Array.isArray(pageSearchContext.SEARCH_INDEX), 'Page Search documents must remain available');
const pageSearchSerialized = JSON.stringify(pageSearchContext.SEARCH_INDEX);
for (const forbidden of ['青龙掠月刀', 'qinglong-lueyue-dao', '偃月刀']) {
  assert(!pageSearchSerialized.includes(forbidden), `Page Search must exclude draft Qinglong: ${forbidden}`);
}
assert(!mainJs.includes('偃月刀'), 'Search UI must not expose the draft Qinglong alias');
const pageSearchDocuments = pageSearchContext.getSearchDocuments();
assert.equal(pageSearchDocuments.length, pageSearchContext.SEARCH_INDEX.length, 'Page Search must remain available while Entity Search is unavailable');
function searchPageDocuments(query) {
  return Array.from(pageSearchContext.findSearchResults(query, pageSearchDocuments));
}
assert.equal(searchPageDocuments('青龙掠月刀').length, 0, 'Draft Qinglong must not produce a Page Search result');
assert.equal(searchPageDocuments('qinglong-lueyue-dao').length, 0, 'Draft Qinglong slug must not produce a Page Search result');
assert.equal(searchPageDocuments('偃月刀').length, 0, 'Draft Qinglong alias must not produce a Page Search result');
function hasPageSearchResult(query, url) {
  return searchPageDocuments(query).some((document) => document.url === url);
}

assert(hasPageSearchResult('影之刃零', '/'), 'Site-name search must retain the homepage Page Search result');
assert(hasPageSearchResult('首页', '/'), 'Homepage search must retain the homepage Page Search result');
assert(hasPageSearchResult('武器', '/weapons'), 'Weapon category search must retain the /weapons Page Search result');
assert(!hasPageSearchResult('武器', '/'), 'Weapon category search must exclude the homepage Page Search result');
assert(hasPageSearchResult('角色', '/characters'), 'Character category search must retain the /characters Page Search result');
assert(!hasPageSearchResult('角色', '/'), 'Character category search must exclude the homepage Page Search result');
assert(hasPageSearchResult('Boss', '/bosses'), 'Boss category search must retain the /bosses Page Search result');
assert(!hasPageSearchResult('Boss', '/'), 'Boss category search must exclude the homepage Page Search result');
assert(hasPageSearchResult('世界', '/world'), 'World category search must retain the /world Page Search result');
assert(!hasPageSearchResult('世界', '/'), 'World category search must exclude the homepage Page Search result');
assert(hasPageSearchResult('地点', '/world'), 'Location category search must retain the /world Page Search result');
assert(!hasPageSearchResult('地点', '/'), 'Location category search must exclude the homepage Page Search result');

assert.equal(
  pageSearchContext.normalizeSearchText('  Commander   Cleave  '),
  'commander cleave',
  'Search normalization must normalize whitespace and case'
);

const entitySearchSource = mainJs.slice(mainJs.indexOf('var ENTITY_SEARCH_INDEX_URL'), mainJs.indexOf('function getSearchDocuments()'));
const context = {};
vm.runInNewContext(entitySearchSource, context);
const entityDocuments = ['weapon', 'character', 'boss', 'location'].map((entityType) => ({
  id: `${entityType}:fixture`, documentType: 'entity', entityType, route: `/${entityType}s/fixture`,
  displayName: `${entityType} Fixture`, summary: 'Fixture summary', aliases: [], displayAliases: [], keywords: [],
  recordState: 'published', sourceSchemaVersion: '1.0-implementation'
}));
assert.equal(context.validateEntitySearchDocuments(entityDocuments), true, 'Entity Search must accept Weapon, Character, Boss, and Location documents');
assert.equal(context.validateEntitySearchDocuments([{ ...entityDocuments[0], entityType: 'unknown' }]), false, 'Entity Search must reject unknown Entity types');
assert.equal(
  JSON.stringify(entityDocuments.map((document) => context.normalizeEntitySearchDocument(document).tag)),
  JSON.stringify(['武器', '角色', 'Boss', '地点']),
  'Entity Search labels must match Entity types'
);

const productionSearch = JSON.parse(await readFile(join(import.meta.dirname, '../../generated/search-index.production.json'), 'utf8'));
assert(productionSearch.every((document) => document.recordState === 'published'), 'Production Entity Search must contain only published documents');
assert(!productionSearch.some((document) => document.id === 'weapon:qinglong-lueyue-dao'), 'Production Entity Search must exclude draft Qinglong');
assert(productionSearch.some((document) => document.id === 'weapon:tang-hengdao'), 'Production Entity Search must retain published Tang Hengdao');

function publishedEntityResultKeys(entityType) {
  return productionSearch
    .filter((document) => document.entityType === entityType)
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map((document) => `${document.displayName}\t${document.route}\tentity`);
}

pageSearchContext.entitySearchIndex = productionSearch.map((document) => pageSearchContext.normalizeEntitySearchDocument(document));
const allSearchDocuments = pageSearchContext.getSearchDocuments();

function resultKeys(query) {
  return Array.from(pageSearchContext.findSearchResults(query, allSearchDocuments), (document) =>
    `${document.title}\t${document.url}\t${document.documentType}`
  );
}

function assertResultKeys(query, expected) {
  assert.deepEqual(resultKeys(query), expected, `${query}: Search ranking or result suppression changed`);
}

assertResultKeys('武器', [
  '武器图鉴\t/weapons\tpage',
  ...publishedEntityResultKeys('weapon')
]);
assertResultKeys('角色', [
  '角色图鉴\t/characters\tpage',
  ...publishedEntityResultKeys('character')
]);
assertResultKeys('Boss', [
  'Boss攻略\t/bosses\tpage',
  ...publishedEntityResultKeys('boss')
]);
assertResultKeys('世界', ['世界观设定\t/world\tpage']);
assertResultKeys('地点', [
  '世界观设定\t/world\tpage',
  ...publishedEntityResultKeys('location')
]);
assertResultKeys('攻略', [
  '攻略中心\t/guide\tpage',
  '影之刃零攻略站\t/\tpage',
  'Boss攻略\t/bosses\tpage'
]);
assertResultKeys('视频', ['视频中心\t/videos\tpage']);
assertResultKeys('购买', ['购买指南\t/about\tpage']);
assertResultKeys('唐横刀', ['唐横刀\t/weapons/tang-hengdao\tentity']);
assertResultKeys('魂', ['魂\t/characters/soul\tentity']);
assertResultKeys('Soul', ['魂\t/characters/soul\tentity']);
assertResultKeys('Commander Cleave', ['Commander Cleave\t/bosses/commander-cleave\tentity']);
assertResultKeys('  commander   cleave  ', ['Commander Cleave\t/bosses/commander-cleave\tentity']);
assertResultKeys('庞镇', ['庞镇\t/world/pangzhen\tentity']);
assertResultKeys('青龙掠月刀', []);

const deterministicTieDocuments = [
  { id: 'entity:z', documentType: 'entity', title: 'Z', aliases: [], tag: '武器', keywords: [], desc: '' },
  { id: 'entity:a', documentType: 'entity', title: 'A', aliases: [], tag: '武器', keywords: [], desc: '' }
];
assert.deepEqual(
  Array.from(pageSearchContext.findSearchResults('武器', deterministicTieDocuments), (document) => document.id),
  ['entity:a', 'entity:z'],
  'Equal scores must use stable lexical document id ordering'
);

const descriptionFallbackDocuments = [
  { id: 'page:strong', documentType: 'page', title: '武器图鉴', tag: '武器', categoryTerms: ['武器'], aliases: [], keywords: '', desc: '' },
  { id: 'entity:description', documentType: 'entity', title: 'Other', tag: '角色', categoryTerms: [], aliases: [], keywords: [], desc: '武器构筑' }
];
assert.deepEqual(
  Array.from(pageSearchContext.findSearchResults('武器', descriptionFallbackDocuments), (document) => document.id),
  ['page:strong'],
  'Description-only matches must be suppressed when a stronger match exists'
);

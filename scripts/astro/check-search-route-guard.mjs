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

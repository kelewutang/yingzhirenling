import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePublishedCharacterDetailPageSlugs, resolvePublishedWeaponDetailPageSlugs } from '../build-search-index.mjs';

const records = [{ file: 'fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'weapon', id: 'weapon:fixture', slug: 'fixture',
  displayName: 'Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
} }];
const characterRecords = [{ file: 'character-fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'character', id: 'character:fixture', slug: 'fixture-character',
  displayName: 'Character Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
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
  console.log('Astro Search route guard fixtures passed.');
} finally {
  await rm(directory, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePublishedWeaponDetailPageSlugs } from '../build-search-index.mjs';

const records = [{ file: 'fixture.json', entity: {
  schemaVersion: '1.0-implementation', entityType: 'weapon', id: 'weapon:fixture', slug: 'fixture',
  displayName: 'Fixture', summary: 'Fixture summary', summaryFactIds: ['fact:fixture'], aliases: [], facts: [], recordState: 'published'
} }];
const directory = await mkdtemp(join(tmpdir(), 'p1-10-route-guard-'));
try {
  await assert.rejects(() => resolvePublishedWeaponDetailPageSlugs(records, directory, false), /缺少详情页/);
  await writeFile(join(directory, 'fixture.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/wrong">');
  await assert.rejects(() => resolvePublishedWeaponDetailPageSlugs(records, directory, false), /canonical/);
  await writeFile(join(directory, 'fixture.html'), '<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/fixture">');
  assert.deepEqual([...await resolvePublishedWeaponDetailPageSlugs(records, directory, false)], ['fixture']);
  console.log('Astro Search route guard fixtures passed.');
} finally {
  await rm(directory, { recursive: true, force: true });
}

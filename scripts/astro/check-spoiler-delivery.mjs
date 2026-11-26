import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKnowledge } from '../../src/lib/knowledge.mjs';
import { entitySafeProjection, spoilerProtectionApplies } from '../../src/lib/spoilers.mjs';
import { loadProductionInventory } from './production-inventory.mjs';

const root = resolve(import.meta.dirname, '../..');
const knowledge = await loadKnowledge();
const inventory = await loadProductionInventory(root);
const search = JSON.parse(await readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'));
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
assert.equal(spoilerProtectionApplies(), false, 'Current candidate requires explicit released lifecycle and Owner open-guides decision');
assert.equal(inventory.publishedLocations.length, 9);
assert.equal(inventory.publishedBosses.length, 54);
assert.equal(search.length, 120, '66 baseline documents + 54 newly admitted entities');
for (const [directory, entities] of [
  ['weapons', inventory.publishedWeapons], ['characters', inventory.publishedCharacters],
  ['bosses', inventory.publishedBosses], ['world', inventory.publishedLocations],
  ['accessories', inventory.publishedAccessories], ['flasks', inventory.publishedFlasks]
]) {
  const collection = await readFile(resolve(root, 'dist', `${directory}.html`), 'utf8');
  assert.doesNotMatch(collection, /data-spoiler-level="major"|data-nosnippet|含部分剧情信息/);
  for (const entity of entities) {
    const name = escapeHtml(entity.displayName);
    assert.equal(entitySafeProjection(entity).concealed, false, entity.id);
    assert(collection.includes(`href="/${directory}/${entity.slug}"`), `${entity.id}: collection link missing`);
    assert(collection.includes(name), `${entity.id}: real card name missing`);
    const document = search.find((item) => item.id === entity.id);
    assert(document, `${entity.id}: must be searchable`);
    assert.equal(document.displayName, entity.displayName, entity.id);
    assert.equal(document.route, `/${directory}/${entity.slug}`, entity.id);
    const html = await readFile(resolve(root, 'dist', directory, `${entity.slug}.html`), 'utf8');
    assert.equal((html.match(/<h1\b/g) || []).length, 1, entity.id);
    assert(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0].includes(name), `${entity.id}: real H1 missing`);
    assert(html.match(/<title>[\s\S]*?<\/title>/)?.[0].includes(name), `${entity.id}: real Title missing`);
    assert(html.match(/<meta name="description" content="([^"]+)"/)?.[1], `${entity.id}: Description missing`);
    assert.doesNotMatch(html, /data-spoiler-level="major"|data-nosnippet|含部分剧情信息|<meta name="robots" content="noindex/, entity.id);
    if (['boss', 'location'].includes(entity.entityType)) {
      assert(html.includes(`content="${escapeHtml(`${entity.displayName}：${entity.summary}`)}"`), `${entity.id}: real Description missing`);
      assert(html.includes(`"name":"${entity.displayName}"`), `${entity.id}: structured breadcrumb must use real name`);
    }
  }
}
for (const entity of knowledge.entityById.values()) {
  if (entity.recordState !== 'published') assert(!search.some((item) => item.id === entity.id), `${entity.id}: unadmitted identity leaked into Search`);
}
console.log('Released open-guide delivery passed: 9 Locations, 54 Boss groups, 119 published Entities, 120 Search documents, real static names/SEO, no spoiler concealment, drafts excluded.');

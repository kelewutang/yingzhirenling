import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKnowledge } from '../src/lib/knowledge.mjs';
import { publishedItems, itemDetail } from '../src/lib/items.mjs';
import { validateItem } from '../src/lib/item-validation.mjs';
import { buildSearchDocuments, resolvePublishedItemDetailPageSlugs } from '../scripts/build-search-index.mjs';

const knowledge = await loadKnowledge();
const validate = (entity, sources = knowledge.sourceById) => {
  const errors = [];
  validateItem(entity, sources, knowledge.versionById, (_, message) => errors.push(message));
  return errors;
};
const clone = (value) => structuredClone(value);
const flask = publishedItems(knowledge, 'flask')[0];

test('24 independent items retain full screenshot effects and separate level/uses', () => {
  assert.equal(publishedItems(knowledge, 'accessory').length, 13);
  assert.equal(publishedItems(knowledge, 'flask').length, 11);
  for (const entity of [...knowledge.accessories, ...knowledge.flasks]) assert.deepEqual(validate(entity), []);
  assert.equal(itemDetail(flask).quick.length, 3);
  assert.equal(knowledge.weapons.filter((entity) => entity.recordState === 'published').length, 26);
});

test('wrong item counts, missing fields, duplicate current facts and foreign Weapon keys fail closed', () => {
  for (const mutate of [
    (entity) => { entity.facts.find((fact) => fact.key === 'flask.uses').value = '0'; },
    (entity) => { entity.facts.find((fact) => fact.key === 'flask.level').value = 'unknown'; },
    (entity) => { entity.facts = entity.facts.filter((fact) => fact.key !== 'flask.uses'); },
    (entity) => { entity.facts.push(clone(entity.facts[0])); },
    (entity) => { entity.facts[0].key = 'weapon.baseStat'; },
    (entity) => { entity.summary = 'unsupported'; }
  ]) { const entity = clone(flask); mutate(entity); assert(validate(entity).length > 0); }
});

test('changed wording, cross-item evidence, missing claims, corrupt hashes and wrong versions fail closed', () => {
  const id = flask.facts[0].sourceIds[0];
  for (const mutate of [
    (source) => { source.locator.itemClaims.find((claim) => claim.entityId === flask.id).value = 'unsupported'; },
    (source) => { source.locator.itemClaims.find((claim) => claim.entityId === flask.id).evidenceItemId = 'missing-image'; },
    (source) => { source.locator.itemClaims = []; },
    (source) => { source.recordState = 'archived'; },
    (source) => { source.locator.evidenceItems.find((item) => item.entityId === flask.id).sha256 = 'bad-hash'; },
    (source) => { source.locator.evidenceItems.find((item) => item.entityId === flask.id).readableText.name = 'unsupported'; }
  ]) { const source = clone(knowledge.sourceById.get(id)); mutate(source); assert(validate(flask, new Map([[id, source]])).length > 0); }
  const entity = clone(flask); entity.facts[0].gameVersionId = 'version:prelaunch-demo-2024'; assert(validate(entity).length > 0);
});

test('draft, archived and major-spoiler items do not enter production Search', () => {
  for (const mutate of [
    (entity) => { entity.recordState = 'draft'; },
    (entity) => { entity.recordState = 'archived'; },
    (entity) => { entity.spoilerLevel = 'major'; entity.safeDisplayName = 'Hidden'; entity.safeSummary = 'Hidden'; }
  ]) {
    const entity = clone(flask); mutate(entity);
    const result = buildSearchDocuments([{ entity, file: 'fixture:item' }], 'production', new Map([['flask', new Set([entity.slug])]]), knowledge);
    assert.equal(result.documents.length, 0);
  }
});

test('item Search rejects a missing detail and a detail with a wrong canonical', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-item-canonical-'));
  try {
    const records = [{ entity: flask, file: 'fixture:item' }];
    await assert.rejects(resolvePublishedItemDetailPageSlugs(records, 'flask', directory));
    await writeFile(join(directory, `${flask.slug}.html`), '<link rel="canonical" href="https://www.yingzhirenling.cn/incorrect">');
    await assert.rejects(resolvePublishedItemDetailPageSlugs(records, 'flask', directory), /canonical mismatch/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

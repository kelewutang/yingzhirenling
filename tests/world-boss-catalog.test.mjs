import assert from 'node:assert/strict';
import test from 'node:test';
import { loadKnowledge } from '../src/lib/knowledge.mjs';
import { entitySafeProjection, relationIsConcealed } from '../src/lib/spoilers.mjs';
import { buildSearchDocuments } from '../scripts/build-search-index.mjs';

test('catalog preserves existing identities and closes evidence and region references', async () => {
  const k = await loadKnowledge();
  const batch = [...k.entityById.values()].filter((e) => e.facts.some((f) => f.gameVersionId === 'version:world-boss-catalog-2026-11-26'));
  assert.equal(batch.filter((e) => e.entityType === 'boss').length, 49);
  assert.equal(batch.filter((e) => e.entityType === 'location').length, 5);
  for (const e of batch) {
    assert.equal(e.recordState, 'published');
    for (const key of ['exists', 'name', 'kind']) {
      const f = e.facts.find((f) => f.key === `${e.entityType}.${key}` && !f.supersededBy);
      assert(f && f.sourceIds.length && f.status === 'third-party', e.id);
      assert(f.sourceIds.every((id) => k.sourceById.has(id)), e.id);
    }
    if (e.entityType === 'boss') {
      const relations = k.relations.filter((r) => r.sourceEntityId === e.id && r.relationType === 'appearsIn');
      assert(relations.length, e.id);
      for (const r of relations) {
        assert.equal(k.entityById.get(r.targetEntityId)?.recordState, 'published');
        assert(r.basisFactIds.every((id) => k.factById.has(id)), r.id);
        assert.equal(relationIsConcealed(r, k), false, r.id);
      }
    }
    if (e.spoilerLevel === 'major') {
      assert.equal(entitySafeProjection(e).concealed, false);
      assert.equal(entitySafeProjection(e).displayName, e.displayName, e.id);
    }
  }
  for (const slug of ['tie-sha-the-frenzy', 'huangxing-sunken-pillar-kunlun']) {
    const e = k.entityById.get('boss:' + slug);
    assert(e.facts.some((f) => f.gameVersionId === 'version:prelaunch-demo-2024'));
    assert.equal(e.facts.find((f) => f.id === `fact:boss:${slug}:name`).supersededBy, `fact:boss:${slug}:catalog-name`);
  }
  assert.equal(k.entityById.get('boss:commander-cleave').recordState, 'draft');
  assert.equal(k.relations.filter((r) => r.sourceEntityId === 'boss:you-long' && r.relationType === 'appearsIn').length, 2);
  assert.equal(k.relations.filter((r) => r.sourceEntityId === 'boss:jinmianju-heiyiren' && r.relationType === 'appearsIn').length, 4);
  assert(!k.entityById.has('boss:huang-xing') && !k.entityById.has('boss:tie-sha'));
});

test('released Search retains both character and Boss identities with the same slug, rejecting duplicates within a family', async () => {
  const k = await loadKnowledge();
  const boss = k.entityById.get('boss:mu-xiaokui');
  const character = k.entityById.get('character:mu-xiaokui');
  const routes = new Map([['boss', new Set([boss.slug])], ['character', new Set([character.slug])]]);
  const build = (entities) => buildSearchDocuments(entities.map((entity) => ({ entity, file: 'fixture:identity' })), 'production', routes, k);
  const documents = build([boss, character]).documents;
  assert.deepEqual(documents.map(({ id, route }) => ({ id, route })), [
    { id: boss.id, route: '/bosses/mu-xiaokui' }, { id: character.id, route: '/characters/mu-xiaokui' }
  ]);
  assert.throws(() => build([boss, { ...boss, id: 'boss:duplicate' }]), /重复 Search Document slug/);
  assert.throws(() => build([boss, boss]), /重复 Search Document id/);
  assert.throws(() => build([boss, { ...boss, id: 'boss:duplicate', slug: 'duplicate' }]), /重复 Search Document displayName/);
});

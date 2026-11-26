import assert from 'node:assert/strict';
import test from 'node:test';
import { loadKnowledge, getFact, getProductionRelationsForEntity } from '../src/lib/knowledge.mjs';
import { projectBossFacts, projectCharacterFacts, projectLocationFacts } from '../src/lib/projections.mjs';
import { factIsConcealed } from '../src/lib/spoilers.mjs';

const batch = [
  ['boss', 'cangang'], ['boss', 'peng-meng'], ['boss', 'a-hua'], ['boss', 'zhui-ming'], ['boss', 'hua-qianxiao'],
  ['character', 'yu-er'], ['character', 'zuo-shang'], ['character', 'mu-xiaokui'],
  ['location', 'beiqi-xigu'], ['location', 'xuese-senlin'], ['location', 'lujia-cun']
];
const project = { boss: projectBossFacts, character: projectCharacterFacts, location: projectLocationFacts };

test('release content has sourced independent facts and preserves the three existing Boss identities', async () => {
  const k = await loadKnowledge();
  for (const [type, slug] of batch) {
    const e = k.entityById.get(`${type}:${slug}`);
    assert.equal(e.recordState, 'published');
    assert.equal(e.slug, slug);
    assert(e.facts.length >= 5);
    const current = project[type](e, k);
    assert(current.every((f) => f.status === 'third-party' || f.status === 'official' ||
      (f.id === 'fact:boss:a-hua:research-20261126-arena-advice' && f.status === 'editorial' && f.basisFactIds.length === 3)));
    assert(current.every((f) => f.sourceIds.every((id) => k.sourceById.has(id)) &&
      (f.sourceIds.length || (f.status === 'editorial' && f.basisFactIds.every((id) => k.factById.has(id))))));
    assert(current.every((f) => f.versionText === (f.id.includes(':research-20261126-')
      ? '发售后公开攻略补充（查阅于2026-11-26，客户端版本未知）' : '发售后公开攻略（截至2026-11-16）')));
    assert(current.every((f) => !f.valueText.includes('[object Object]')));
    assert(current.some((f) => f.key === `${type}.exists` && f.valueText.includes('发售后')));
    for (const id of e.summaryFactIds) assert(!factIsConcealed(k.factById.get(id), e), `${e.id}: concealed Fact in summary support`);
    if (type === 'boss') for (const key of ['location', 'mechanic', 'strategy', 'reward']) assert(current.some((f) => f.key === `boss.${key}`));
  }
  for (const slug of ['cangang', 'peng-meng', 'hua-qianxiao']) {
    const e = k.entityById.get(`boss:${slug}`);
    const historical = e.facts.find((f) => f.id === `fact:boss:${slug}:name`);
    assert(historical.supersededBy);
    assert.equal(historical.sourceIds[0], 'source:a9vg-beijing-hands-on-2026-10-09');
    assert.equal(getFact(e, 'boss.name', k).checkedAt, '2026-11-16');
    assert(e.aliases.some((a) => a.locale === 'en'));
  }
});

test('repeatable details retain every active entry including historical major spoilers', () => {
  const fact = (id, extra = {}) => ({ id, key: 'boss.mechanic', valueType: 'object', value: { name: id, description: `${id} description` }, status: 'third-party', sourceIds: [], gameVersionId: 'release', checkedAt: '2026-11-16', supersededBy: null, validToVersionId: null, ...extra });
  const e = { entityType: 'boss', facts: [fact('first'), fact('second', { spoilerLevel: 'major' }), fact('old', { validToVersionId: 'release' }), fact('superseded', { supersededBy: 'first' }), fact('pending', { status: 'pending-review', value: null })] };
  const k = { versionById: new Map([['release', { track: 'release' }]]) };
  const result = projectBossFacts(e, k);
  assert.deepEqual(result.map((f) => f.id), ['first', 'second']);
  assert.equal(result[0].title, 'first');
  assert.equal(result[0].valueText, 'first description');
  assert.equal(factIsConcealed(result[1], e), false);
});

test('only the exact official patch statement gains official status', async () => {
  const k = await loadKnowledge();
  const e = k.entityById.get('boss:a-hua');
  const patch = getFact(e, 'boss.mechanic', k);
  const official = e.facts.filter((f) => f.status === 'official');
  assert.equal(official.length, 1);
  assert.match(official[0].value.description, /入阵者、破局者/);
  assert.match(official[0].value.description, /不适用于其他难度/);
  assert.equal(k.sourceById.get(official[0].sourceIds[0]).authority, 'official');
  assert(patch);
  assert.equal([...k.factById.values()].filter((f) => f.status === 'release-verified').length, 0);
});

test('plot-dependent return trips stay out of summaries and unrelated identities stay separate', async () => {
  const k = await loadKnowledge();
  const hidden = k.factById.get('fact:location:beiqi-xigu:release-hidden-outpost');
  assert.equal(hidden.spoilerLevel, 'major');
  assert.equal(k.factById.get('fact:character:mu-xiaokui:release-encounter').spoilerLevel, 'major');
  assert(!k.entityById.get('location:beiqi-xigu').summary.includes('一个不留'));
  assert.equal(k.entityById.get('character:the-hunt').displayName, 'The Hunt');
  assert.equal(getProductionRelationsForEntity('character:zuo-shang', k).length, 1);
  assert.equal(getProductionRelationsForEntity('character:soul', k).length, 3);
});

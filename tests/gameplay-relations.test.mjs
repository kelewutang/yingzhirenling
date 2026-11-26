import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadKnowledge, getProductionRelationsForEntity } from '../src/lib/knowledge.mjs';
import { getBossConnections, getLocationBosses, getWeaponAcquisition, projectGameplayRelations } from '../src/lib/gameplay-relations.mjs';
import { projectRelationsForEntity } from '../src/lib/relations.mjs';

const pairs = [
  ['cangang', 'beiqi-xigu', 'jagged-steel'],
  ['peng-meng', 'beiqi-xigu', 'juxiong-fu'],
  ['a-hua', 'beiqi-xigu', 'hongzhuang-guizhan'],
  ['zhui-ming', 'beiqi-xigu', 'zhuiming-suolian'],
  ['hua-qianxiao', 'xuese-senlin', 'chizhe-canjian']
];
const fresh = async () => structuredClone(await loadKnowledge());
for (const [boss, area, weapon] of pairs) test(`one evidence record drives both directions: ${boss}`, async () => {
  const k = await loadKnowledge(), b = getBossConnections('boss:' + boss, k);
  assert.deepEqual(b.locations.map((e) => e.entity.id), ['location:' + area]);
  assert.deepEqual(b.weapons.map((e) => e.entity.id), ['weapon:' + weapon]);
  assert.strictEqual(getWeaponAcquisition('weapon:' + weapon, k)[0].relation, b.weapons[0].relation);
  const reverse = getLocationBosses('location:' + area, k).find((e) => e.entity.id === 'boss:' + boss);
  assert.strictEqual(reverse.relation, b.locations[0].relation);
  for (const e of [...b.locations, ...b.weapons]) {
    assert.equal(e.relation.status, 'third-party');
    assert(e.relation.sourceIds.every((id) => k.sourceById.get(id).authority === 'third-party'));
    assert(e.href.startsWith(e.entity.entityType === 'location' ? '/world/' : '/weapons/'));
  }
});
test('a region retains multiple Bosses in the established collection order', async () => {
  const k = await loadKnowledge();
  assert.deepEqual(getLocationBosses('location:beiqi-xigu', k).map((e) => e.entity.id), [
    ...pairs.slice(0, 4).map(([id]) => 'boss:' + id),
    'boss:jinmianju-heiyiren', 'boss:qingdaofu-hansui', 'boss:sanmian-moou'
  ]);
});
test('multiple rewards use separate edges without inventing a single reward limit', async () => {
  const k = await fresh(), r = structuredClone(k.relations.find((r) => r.sourceEntityId === 'boss:cangang' && r.relationType === 'awardsWeapon'));
  r.id = 'relation:fixture:extra-reward'; r.targetEntityId = 'weapon:huo-liuxing'; k.relations.push(r);
  assert.equal(getBossConnections('boss:cangang', k).weapons.length, 2);
  assert.equal(getWeaponAcquisition('weapon:huo-liuxing', k)[0].entity.id, 'boss:cangang');
});
test('unknown acquisition is omitted rather than labelled no drop, and old acquisition facts remain intact', async () => {
  const k = await loadKnowledge();
  assert.deepEqual(projectGameplayRelations(k.entityById.get('weapon:huo-liuxing'), k), []);
  const boss = structuredClone(k); boss.relations = boss.relations.filter((r) => r.relationType !== 'awardsWeapon');
  assert.deepEqual(getBossConnections('boss:cangang', boss).weapons, []);
  const historical = k.entityById.get('weapon:chizhe-canjian').facts.find((f) => f.key === 'weapon.acquisition');
  assert.equal(historical.validToVersionId, 'version:release-pc-ui-2026-11-16');
  assert(historical.value.includes('试玩'));
});
test('Draft and archived endpoints never leak in either direction or nested rewards', async () => {
  for (const state of ['draft', 'archived']) for (const id of ['boss:cangang', 'weapon:jagged-steel', 'location:beiqi-xigu']) {
    const k = await fresh(); k.entityById.get(id).recordState = state;
    const all = [...getLocationBosses('location:beiqi-xigu', k), ...getWeaponAcquisition('weapon:jagged-steel', k), ...getBossConnections('boss:cangang', k).locations, ...getBossConnections('boss:cangang', k).weapons];
    assert(!all.some((e) => e.entity.id === id || e.children.some((c) => c.entity.id === id)));
    if (id === 'boss:cangang') assert(!getLocationBosses('location:beiqi-xigu', k).some((e) => e.entity.id === id));
  }
});
test('pending-review and ended edges are absent from all current public paths', async () => {
  for (const patch of [{ status: 'pending-review' }, { validToVersionId: 'version:release-pc-ui-2026-11-17-batch3' }]) {
    const k = await fresh(); for (const r of k.relations) if (r.relationType === 'awardsWeapon') Object.assign(r, patch);
    assert.deepEqual(getWeaponAcquisition('weapon:jagged-steel', k), []);
    assert(getLocationBosses('location:beiqi-xigu', k).every((e) => !e.children.length));
  }
});
test('version switches select historical windows and do not expose future relations as current', async () => {
  const k = await fresh(), start = 'version:release-guides-2026-11-16', end = 'version:release-pc-ui-2026-11-17-batch3';
  const r = k.relations.find((r) => r.relationType === 'awardsWeapon' && r.sourceEntityId === 'boss:cangang'); r.validToVersionId = end;
  assert.equal(getWeaponAcquisition('weapon:jagged-steel', k, start).length, 1);
  assert.equal(getWeaponAcquisition('weapon:jagged-steel', k, end).length, 0);
  r.validToVersionId = null; r.validFromVersionId = 'version:fixture:future';k.versionById.set('version:fixture:future', { sequence: 1000 });
  // The explicitly selected version is before this newly announced relation.
  assert.equal(getWeaponAcquisition('weapon:jagged-steel', k, end).length, 0);
});
test('relation, basis Fact, endpoint and nested reward spoilers remain visible after release without altering underlying provenance', async () => {
  for (const variant of ['relation', 'basis', 'endpoint', 'nested']) {
    const k = await fresh(), r = k.relations.find((r) => r.sourceEntityId === 'boss:cangang' && r.relationType === 'appearsIn');
    if (variant === 'relation') r.spoilerLevel = 'major';
    if (variant === 'basis') k.factById.get(r.basisFactIds[0]).spoilerLevel = 'major';
    if (variant === 'endpoint') k.entityById.get('boss:cangang').spoilerLevel = 'major';
    if (variant === 'nested') k.entityById.get('weapon:jagged-steel').spoilerLevel = 'major';
    const g = projectGameplayRelations(k.entityById.get('location:beiqi-xigu'), k), entry = g[0].entries.find((e) => e.entity.id === 'boss:cangang');
    assert.equal(entry.concealed, false); assert.deepEqual(entry.relation.sourceIds, r.sourceIds);
  }
});
test('existing character relationship labels and inverse endpoints remain unchanged', async () => {
  const k = await loadKnowledge();
  const relations = projectRelationsForEntity('character:soul', getProductionRelationsForEntity('character:soul', k), k);
  assert.equal(relations.length, 3); assert(relations.every((r) => r.otherEntity.entityType === 'character'));
  assert(relations.some((r) => r.label === '魂的父亲' && r.otherEntity.id === 'character:mo-yuan'));
});
async function validateMutation(change, pattern, pass = false) {
  const dir = await mkdtemp(join(tmpdir(), 'pbz-rel01-fixture-'));
  try {
    await cp(new URL('../data/', import.meta.url), join(dir, 'data'), { recursive: true });
    const file = join(dir, 'data/relations/cangang-appearsIn.json');
    const relation = JSON.parse(await readFile(file, 'utf8'));
    await change(relation, dir); await writeFile(file, JSON.stringify(relation));
    const r = spawnSync(process.execPath, ['scripts/validate-data.mjs', '--data-dir=' + join(dir, 'data')], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
    if (pass) assert.equal(r.status, 0, r.stdout + r.stderr);
    else { assert.notEqual(r.status, 0); assert.match(r.stdout + r.stderr, pattern); }
  } finally { await rm(dir, { recursive: true, force: true }); }
}
test('validator rejects missing endpoint IDs', () => validateMutation((r) => {r.targetEntityId = 'location:fixture-missing';}, /Entity 不存在/));
test('validator rejects incorrect Boss to Location/Weapon endpoint types', () => validateMutation((r) => {r.targetEntityId = 'weapon:jagged-steel';}, /必须是 boss → location/));
test('validator rejects overlapping duplicate edges', () => validateMutation(async (r, dir) => {await writeFile(join(dir, 'data/relations/fixture-duplicate.json'), JSON.stringify({ ...r, id: 'relation:fixture:duplicate' }));}, /有效区间重复/));
test('validator rejects missing or foreign sources and unearned official status', async () => {
  await validateMutation((r) => {r.sourceIds = ['source:fixture-missing'];}, /Source 不存在/);
  await validateMutation((r) => {r.status = 'official';}, /不得超出依据 Fact/);
});
test('validator rejects unrelated evidence and missing basis', async () => {
  await validateMutation((r) => {r.basisFactIds = ['fact:boss:peng-meng:release-location'];}, /必须引用关系起点/);
  await validateMutation((r) => {delete r.basisFactIds;}, /必须引用一条/);
});
test('validator rejects invalid scopes and invalid dates', async () => {
  await validateMutation((r) => {r.scope.platforms = { mode: 'include', ids: ['platform:fixture-missing'] };}, /平台不存在/);
  await validateMutation((r) => {r.checkedAt = '2026-02-30';}, /合法的 YYYY-MM-DD/);
});
test('validator rejects unknown, reversed versions and lowered spoiler protection', async () => {
  await validateMutation((r) => {r.validToVersionId = 'version:fixture-missing';}, /GameVersion 不存在/);
  await validateMutation((r) => {r.validToVersionId = r.validFromVersionId;}, /区间必须递增/);
  await validateMutation((r) => {delete r.spoilerLevel;}, /关系剧透等级/);
});
test('non-overlapping historical relation records remain valid rather than erasing history', () => validateMutation(async (r, dir) => {
  const end = r.validFromVersionId;
  await writeFile(join(dir, 'data/relations/fixture-history.json'), JSON.stringify({ ...r, id: 'relation:fixture:history', validFromVersionId: null, validToVersionId: end }));
}, null, true));

test('superseded or ended evidence never projects an apparently active current edge', async () => {
  for (const patch of [{supersededBy: 'fact:fixture:new'}, {validToVersionId: 'version:release-pc-ui-2026-11-17-batch3'}]) {
    const k = await fresh(), r = k.relations.find((r) => r.sourceEntityId === 'boss:cangang' && r.relationType === 'awardsWeapon');
    Object.assign(k.factById.get(r.basisFactIds[0]), patch);
    assert.deepEqual(getWeaponAcquisition('weapon:jagged-steel', k), []);
  }
});
test('current edges cannot outlive their basis facts or lower major fact classification', async () => {
  await validateMutation(async (r, dir) => {
    const file = join(dir, 'data/bosses/cangang.json'), e = JSON.parse(await readFile(file, 'utf8'));
    e.facts.find((f) => f.id === r.basisFactIds[0]).validToVersionId = 'version:release-pc-ui-2026-11-17-batch3';
    await writeFile(file, JSON.stringify(e));
  }, /有效关系不得引用已失效/);
  await validateMutation(async (r, dir) => {
    const file = join(dir, 'data/bosses/cangang.json'), e = JSON.parse(await readFile(file, 'utf8'));
    e.facts.find((f) => f.id === r.basisFactIds[0]).spoilerLevel = 'major';
    await writeFile(file, JSON.stringify(e));
  }, /不得降低依据 Fact/);
});

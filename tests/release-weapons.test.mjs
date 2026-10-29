import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { getFact, getPublishedWeapons, loadKnowledge } from '../src/lib/knowledge.mjs';
import { projectWeaponDetail } from '../src/lib/projections.mjs';
import { buildWeaponCollectionCard } from '../src/lib/collection-models.mjs';

const root = resolve(import.meta.dirname, '..');
const sourceId = 'source:owner-pc-release-weapons-2026-10-29';
const expectations = [
  ['muzhi-heishang', '木制黑伤', '单手', [['伤害能力', 160], ['破防能力', 80]]],
  ['heishang', '黑伤', '单手', [['伤害能力', 200], ['破防能力', 100]]],
  ['heishang-shuangren', '黑伤双刃', '双持', [['伤害能力', 200], ['破防能力', 100]]],
  ['changxing-heishang', '长形黑伤', '双手', [['伤害能力', 200], ['破防能力', 100]]],
  ['jagged-steel', '残钢刃', '单手', [['伤害能力', 240], ['异常效果', 124]]],
  ['juxiong-fu', '巨凶斧', null, [['伤害能力', 309], ['破防能力', 208]]]
];

test('approved release UI values, optional categories and opening acquisition order stay distinct', async () => {
  const knowledge = await loadKnowledge();
  assert.deepEqual(getPublishedWeapons(knowledge).slice(0, 5).map((item) => item.displayName), expectations.slice(0, 5).map(([, name]) => name));
  for (const [slug, name, grip, stats] of expectations) {
    const weapon = knowledge.entityById.get(`weapon:${slug}`);
    assert.equal(weapon.displayName, name);
    assert.equal(weapon.recordState, 'published');
    assert.equal(getFact(weapon, 'weapon.grip')?.value ?? null, grip);
    assert.equal(getFact(weapon, 'weapon.weaponType'), null, 'A release screenshot must not inherit an unconfirmed demo category');
    const detail = projectWeaponDetail(weapon, knowledge);
    assert.deepEqual(detail.overview.baseStats.map((fact) => [fact.value.statName, fact.value.displayedValue]), stats);
    assert(detail.overview.baseStats.every((fact) => fact.value.displayedLevel === 1 && fact.value.displayContext === 'release-game-ui'));
    assert.deepEqual(detail.progressionNodes.map((fact) => fact.level), [5, 10, 15, 25]);
    assert.equal(detail.overview.previewStats.length, 0);
    assert.equal(buildWeaponCollectionCard(weapon).secondary, grip ? `主武器 · ${grip}` : '影之武装');
    const current = detail.sourceFacts.filter((fact) => fact.gameVersionId === 'version:release-pc-ui-2026-10-29');
    assert(current.every((fact) => fact.status === 'observation' && fact.sourceIds.includes(sourceId)));
    assert(current.every((fact) => fact.scope.platforms.mode === 'include' && fact.scope.platforms.ids.length === 1 && fact.scope.platforms.ids[0] === 'platform:pc'));
  }
});

test('screenshot-specific skill differences and deferred text remain faithful', async () => {
  const knowledge = await loadKnowledge();
  const detail = (slug) => projectWeaponDetail(knowledge.entityById.get(`weapon:${slug}`), knowledge);
  assert.match(detail('heishang').progressionNodes[0].description, /40秒/);
  assert.match(detail('heishang-shuangren').progressionNodes[0].description, /20秒/);
  for (const slug of ['muzhi-heishang', 'heishang']) assert(!detail(slug).mechanics.some((fact) => fact.input === 'L2'));
  const jaggedL2 = detail('jagged-steel').mechanics.find((fact) => fact.input === 'L2');
  assert.equal(jaggedL2.valueText, '残钢乱舞');
  assert.equal(jaggedL2.description, '消耗1精纯杀气。');
  assert.match(detail('juxiong-fu').mechanics[0].description, /消耗1暗源/);
  assert.match(detail('changxing-heishang').progressionNodes[3].description, /消耗全部【刀劲】/);
  assert.equal(knowledge.entityById.get('weapon:jagged-steel').aliases[0].value, 'Jagged Steel');
  assert(knowledge.entityById.get('weapon:jagged-steel').facts.some((fact) => fact.key === 'weapon.weaponType' && fact.value === '剑' && fact.validToVersionId));
});

test('PC screenshot evidence preserves unknown metadata and never invents an internal test session', async () => {
  const knowledge = await loadKnowledge();
  const source = knowledge.sourceById.get(sourceId);
  assert.equal(source.url, null);
  assert.equal(source.authority, 'community');
  assert.equal(source.locator.type, 'user-supplied-game-screenshot');
  assert.equal(source.locator.platformId, 'platform:pc');
  assert.equal(source.locator.versionLabel, null);
  assert.equal(source.locator.capturedAt, null);
  assert.equal(source.locator.evidenceItems.length, 15);
  assert(source.locator.evidenceItems.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.equal([...knowledge.sourceById.values()].filter((item) => item.sourceType === 'site-release-test').length, 0);
  assert.equal([...knowledge.factById.values()].filter((item) => item.status === 'release-verified').length, 0);
});

test('new data contract rejects malformed values without weakening historical evidence gates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-release-weapon-contract-'));
  try {
    await cp(join(root, 'data'), directory, { recursive: true });
    const file = join(directory, 'weapons', 'heishang.json');
    const original = JSON.parse(await readFile(file, 'utf8'));
    for (const [mutate, diagnostic] of [
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.baseStat').value.displayedLevel = 0; }, /displayedLevel/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.baseStat').value.displayedLevel = 3; }, /不得混用等级/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.baseStat').value.displayContext = 'official-pre-release-ui'; }, /release-game-ui/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.baseStat').gameVersionId = 'version:prelaunch-demo-2025'; }, /引用 release GameVersion/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.grip').value = '双手或双持'; }, /enum value/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.acquisitionOrder').value.position = 1; }, /位置不得重复/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.baseStat').status = 'release-verified'; }, /release-verified Fact 至少需要一个/]
    ]) {
      const weapon = structuredClone(original);
      mutate(weapon);
      await writeFile(file, JSON.stringify(weapon));
      const result = spawnSync(process.execPath, [join(root, 'scripts/validate-data.mjs'), `--data-dir=${directory}`], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, diagnostic);
    }
    await writeFile(file, JSON.stringify(original));
    const sourceFile = join(directory, 'sources/owner-pc-release-weapons-2026-10-29.json');
    const source = JSON.parse(await readFile(sourceFile, 'utf8'));
    source.locator.evidenceItems[0].sha256 = 'unknown';
    await writeFile(sourceFile, JSON.stringify(source));
    const result = spawnSync(process.execPath, [join(root, 'scripts/validate-data.mjs'), `--data-dir=${directory}`], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SHA-256/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

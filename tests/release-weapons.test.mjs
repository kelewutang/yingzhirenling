import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getFact, getPublishedWeapons, loadKnowledge } from '../src/lib/knowledge.mjs';
import { projectWeaponDetail, projectWeaponFacts } from '../src/lib/projections.mjs';
import { buildWeaponCollectionCard } from '../src/lib/collection-models.mjs';
import { getProductionHeroMedia, getProductionCardMedia } from '../src/lib/media.mjs';

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

test('only the three English-only identities are withdrawn while Chinese names and historical aliases survive', async () => {
  const knowledge = await loadKnowledge();
  const published = getPublishedWeapons(knowledge);
  assert.equal(published.length, 15);
  for (const [slug, name] of [['bashpole', 'Bashpole'], ['night-owl', 'Night Owl'], ['seamless-death', 'Seamless Death']]) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    assert.equal(entity.recordState, 'draft');
    assert.equal(entity.displayName, name);
    assert(entity.publishedAt && entity.facts.length > 0, 'Withdrawn historical evidence must remain in Knowledge');
    assert(!published.some((item) => item.id === entity.id));
  }
  for (const [slug, name] of [['jagged-steel', '残钢刃'], ['soft-snake-sword', '灵蛇软剑'], ['white-serpent-crimson-viper', '白蟒赤练']]) {
    const entity = published.find((item) => item.slug === slug);
    assert.equal(entity?.displayName, name);
    assert(entity.aliases.length > 0, 'An English historical alias must not cause withdrawal');
  }
});

test('all six release weapons share admitted portrait Hero/Card Masters without replacing the approved dual-blade asset', async () => {
  for (const [slug] of expectations) {
    const hero = await getProductionHeroMedia(`weapon:${slug}`);
    const card = await getProductionCardMedia(`weapon:${slug}`);
    assert(hero && card);
    assert.equal(hero.id, card.id);
    assert.equal(hero.src, card.src);
    assert.deepEqual([hero.width, hero.height, hero.objectFit], [1200, 1800, 'contain']);
    assert.equal(hero.rightsStatus, 'self-captured-reviewed');
    assert.equal(hero.sourceId, sourceId);
    assert.equal(hero.sourceUrl, null);
    assert.equal(hero.caption, 'PC正式版武器界面截图');
    assert.equal(hero.credit, null);
    if (slug !== 'heishang-shuangren') {
      assert.match(hero.processing, /not a complete weapon/);
    } else {
      const bytes = await readFile(join(root, 'assets/media/heishang-shuangren-master.jpg'));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), '9758c9f0a3b71df99d02f617f6a1378a8e971b177bb115c8d6ce1d2344314d5b');
    }
  }
});

test('approved release UI values, optional categories and opening acquisition order stay distinct', async () => {
  const knowledge = await loadKnowledge();
  assert.deepEqual(getPublishedWeapons(knowledge).slice(0, 5).map((item) => item.displayName), expectations.slice(0, 5).map(([, name]) => name));
  for (const [slug, name, grip, stats] of expectations) {
    const weapon = knowledge.entityById.get(`weapon:${slug}`);
    assert.equal(weapon.displayName, name);
    assert.equal(weapon.recordState, 'published');
    assert.equal(getFact(weapon, 'weapon.grip')?.value ?? null, grip);
    assert.equal(getFact(weapon, 'weapon.weaponType')?.value, grip ? `${grip}武器` : '破坏');
    const detail = projectWeaponDetail(weapon, knowledge);
    assert(!detail.overview.notes.some((fact) => fact.key === 'weapon.acquisitionOrder'));
    assert(!detail.sourceFacts.some((fact) => fact.key === 'weapon.acquisitionOrder'));
    assert(!projectWeaponFacts(weapon, knowledge).some((fact) => fact.key === 'weapon.acquisitionOrder'));
    assert.deepEqual(detail.overview.baseStats.map((fact) => [fact.value.statName, fact.value.displayedValue]), stats);
    assert(detail.overview.baseStats.every((fact) => fact.value.displayedLevel === 1 && fact.value.displayContext === 'release-game-ui'));
    assert.deepEqual(detail.progressionNodes.map((fact) => fact.level), [5, 10, 15, 25]);
    assert.equal(detail.overview.previewStats.length, 0);
    assert.equal(buildWeaponCollectionCard(weapon).secondary, grip ? `主武器 · ${grip}武器` : '影之武装 · 破坏');
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

test('new screenshot-backed weapons retain distinct identities, Lv1 stats and later unlock levels', async () => {
  const knowledge = await loadKnowledge();
  const source = 'source:owner-pc-release-weapons-2026-10-30';
  const expected = [
    ['hongzhuang-guizhan', '红妆鬼斩', '主武器 · 双手武器', 240, 117],
    ['yu-gong', '羽弓', '影之武装 · 远程', 180, 164],
    ['zhuiming-suolian', '追命锁镰', '影之武装 · 武学', 247, 213]
  ];
  for (const [slug, name, taxonomy, damage, breakAbility] of expected) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    assert.equal(getPublishedWeapons(knowledge).filter((weapon) => weapon.displayName === name).length, 1);
    assert.equal(entity.slug, slug);
    assert.equal(entity.recordState, 'published');
    assert.equal(getFact(entity, 'weapon.acquisitionOrder', knowledge), null);
    const detail = projectWeaponDetail(entity, knowledge);
    assert.equal(detail.taxonomy.valueText, taxonomy);
    assert.deepEqual(detail.overview.baseStats.map((fact) => [fact.value.statName, fact.value.displayedValue, fact.value.displayedLevel]), [['伤害能力', damage, 1], ['破防能力', breakAbility, 1]]);
    assert.deepEqual(detail.progressionNodes.map((fact) => fact.level), [5, 10, 15, 25]);
    assert.equal(detail.overview.previewStats.length, 0);
    const current = entity.facts.filter((fact) => fact.supersededBy === null);
    assert(current.every((fact) => fact.status === 'observation' && fact.sourceIds.includes(source) && fact.gameVersionId === 'version:release-pc-ui-2026-10-30'));
    const hero = await getProductionHeroMedia(entity.id);
    const card = await getProductionCardMedia(entity.id);
    assert.deepEqual([hero.id, hero.width, hero.height, hero.objectFit, hero.sourceId], [card.id, 1200, 1800, 'contain', source]);
  }
  const reused = knowledge.entityById.get('weapon:hongzhuang-guizhan');
  for (const suffix of ['exists', 'name']) {
    const old = reused.facts.find((fact) => fact.id === `fact:weapon:hongzhuang-guizhan:${suffix}`);
    assert.equal(old.status, 'third-party');
    assert.deepEqual(old.sourceIds, ['source:a9vg-beijing-hands-on-2026-10-09']);
    assert.equal(old.supersededBy, `fact:weapon:hongzhuang-guizhan:release-${suffix}`);
  }
});

test('new weapon resource costs and screenshot-confirmed exceptions remain separate', async () => {
  const knowledge = await loadKnowledge();
  const detail = (slug) => projectWeaponDetail(knowledge.entityById.get(`weapon:${slug}`), knowledge);
  const red = detail('hongzhuang-guizhan');
  assert.match(red.mechanics.find((fact) => fact.input === 'L2').description, /消耗1精纯杀气/);
  assert.match(red.mechanics.find((fact) => fact.valueText === '石蒜花').description, /持续损耗杀气。3秒后/);
  assert.match(red.progressionNodes[0].description, /15秒。○ 可主动引爆/);
  assert.match(red.progressionNodes[2].description, /持续8秒/);
  assert.match(red.progressionNodes[3].description, /白石蒜花/);
  const bow = detail('yu-gong');
  assert.match(bow.mechanics[0].description, /消耗1暗源/);
  assert.deepEqual(bow.progressionNodes.map((fact) => fact.valueText), ['跨蹑柳行·侧', '百步穿杨·之一', '跨蹑柳行·进', '跨蹑柳行·退']);
  assert.match(bow.progressionNodes[0].description, /左摇杆向左 \+ R1 或左摇杆向右 \+ R1/);
  const chain = detail('zhuiming-suolian');
  assert.match(chain.mechanics[0].description, /3段[\s\S]*30%[\s\S]*一套连招消耗1暗源/);
  assert.match(chain.progressionNodes[0].description, /不额外消耗暗源/);
  assert.match(chain.progressionNodes[2].description, /L1 \+ R2[\s\S]*非战斗期间使用不消耗暗源/);
  const source = knowledge.sourceById.get('source:owner-pc-release-weapons-2026-10-30');
  assert.equal(source.locator.evidenceItems.length, 8);
  assert.equal(source.locator.capturedAt, null);
  assert.equal(source.locator.versionLabel, null);
});

test('main and shadow armament classes use separate official vocabularies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-formal-classes-'));
  try {
    await cp(join(root, 'data'), directory, { recursive: true });
    const file = join(directory, 'weapons/juxiong-fu.json');
    const original = JSON.parse(await readFile(file, 'utf8'));
    for (const [category, valid] of [['破坏', true], ['远程', true], ['奇门', true], ['武学', true], ['召唤', true], ['单手武器', false], ['斧', false]]) {
      const entity = structuredClone(original);
      entity.facts.find((fact) => fact.key === 'weapon.weaponType').value = category;
      await writeFile(file, JSON.stringify(entity));
      const result = spawnSync(process.execPath, [join(root, 'scripts/validate-data.mjs'), `--data-dir=${directory}`], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status === 0, valid, `${category}: ${result.stderr}`);
      if (!valid) assert.match(result.stderr, /不符合装备类型的正式版分类/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.weaponType').value = '远程'; }, /不符合装备类型的正式版分类/],
      [(weapon) => { weapon.facts.find((fact) => fact.key === 'weapon.weaponType').value = '剑'; }, /不符合装备类型的正式版分类/],
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

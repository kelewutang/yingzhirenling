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

test('Sharp loads the patched native libraries and round-trips a PNG in memory', async () => {
  const { default: sharp } = await import('sharp');
  assert.equal(sharp.versions.sharp, '0.35.5');
  assert.equal(sharp.versions.rsvg, '2.63.2');
  const png = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#123456' } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 3);
});

test('second owner screenshot batch keeps five unique published weapons, exact Lv1 labels and separate unlock levels', async () => {
  const knowledge = await loadKnowledge();
  const source = 'source:owner-pc-release-weapons-2026-11-16-batch2';
  const version = 'version:release-pc-ui-2026-11-16-batch2';
  const evidence = knowledge.sourceById.get(source);
  assert.equal(evidence.locator.evidenceItems.length, 14);
  assert.equal(new Set(evidence.locator.evidenceItems.map((item) => item.sha256)).size, 14);
  assert.equal(evidence.locator.capturedAt, null);
  assert.equal(evidence.locator.versionLabel, null);
  for (const [slug, name, category, labels, values, mechanics] of [
    ['tianxuan-qingtong-jian', '天玄青铜剑', '主武器 · 单手武器', ['伤害能力', '破防能力'], [240, 106], 4],
    ['kuye-si-zhuchuan', '苦叶寺珠串', '影之武装 · 召唤', ['召唤物生命', '召唤物伤害'], [1236, 22], 1],
    ['cuixin-pipa', '催心琵琶', '影之武装 · 奇门', ['伤害能力', '破防能力'], [276, 234], 2],
    ['luanying-jian', '乱莺剑', '主武器 · 单手武器', ['伤害能力', '破防能力'], [295, 104], 4],
    ['yao-ju', '妖锯', '主武器 · 双持武器', ['伤害能力', '破防能力'], [302, 120], 4]
  ]) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    assert.equal(getPublishedWeapons(knowledge).filter((item) => item.displayName === name).length, 1);
    assert.equal(entity.recordState, 'published');
    assert.equal(entity.slug, slug);
    assert.equal(entity.aliases.length, 0, 'No unsupported English translation may be invented');
    assert.equal(getFact(entity, 'weapon.acquisitionOrder', knowledge), null);
    const detail = projectWeaponDetail(entity, knowledge);
    assert.equal(detail.taxonomy.valueText, category);
    assert.deepEqual(detail.overview.baseStats.map((f) => [f.value.statName, f.value.displayedValue, f.value.displayedLevel]), labels.map((label, i) => [label, values[i], 1]));
    assert.deepEqual(detail.progressionNodes.map((f) => f.level), [5, 10, 15, 25]);
    assert.equal(detail.mechanics.length, mechanics);
    assert.equal(detail.overview.previewStats.length, 0);
    assert(entity.facts.every((f) => f.status === 'observation' && f.gameVersionId === version && f.sourceIds.length === 1 && f.sourceIds[0] === source));
    assert(entity.facts.every((f) => f.scope.platforms.mode === 'include' && f.scope.platforms.ids.length === 1 && f.scope.platforms.ids[0] === 'platform:pc'));
    const hero = await getProductionHeroMedia(entity.id);
    const card = await getProductionCardMedia(entity.id);
    assert.deepEqual([hero.id, hero.src, hero.width, hero.height, hero.objectFit, hero.sourceId, hero.rightsStatus], [card.id, card.src, 1200, 1800, 'contain', source, 'self-captured-reviewed']);
  }
});

test('second batch preserves summon conditions, ordinary rage, dark source and free follow-up boundaries', async () => {
  const knowledge = await loadKnowledge();
  const detail = (slug) => projectWeaponDetail(knowledge.entityById.get(`weapon:${slug}`), knowledge);
  const summon = detail('kuye-si-zhuchuan');
  assert.match(summon.mechanics[0].description, /在杀气浓郁的区域[\s\S]*召唤3个拳法活铜人[\s\S]*最多15秒[\s\S]*重复召唤[\s\S]*消耗2暗源/);
  assert(!summon.overview.baseStats.some((f) => ['伤害能力', '破防能力'].includes(f.value.statName)));
  const lute = detail('cuixin-pipa');
  assert.match(lute.mechanics[0].description, /2段蓝色音刃及1段红色音刃[\s\S]*一套连招消耗1暗源/);
  assert.match(lute.progressionNodes[3].description, /持续消耗暗源/);
  assert(!/持续消耗\d/.test(lute.progressionNodes[3].description), 'No unseen ongoing resource rate may be invented');
  const sword = detail('luanying-jian');
  assert.match(sword.mechanics.find((f) => f.valueText === '鸣剑').description, /消耗一定杀气[\s\S]*持续10秒/);
  assert(!sword.mechanics.find((f) => f.valueText === '鸣剑').description.includes('精纯杀气'));
  assert.match(sword.progressionNodes[0].description, /持续5秒[\s\S]*消散后的6秒/);
  assert.match(sword.progressionNodes[3].description, /10秒[\s\S]*3秒/);
  const saw = detail('yao-ju');
  assert.match(saw.mechanics.find((f) => f.valueText === '妖之形').description, /消耗1精纯杀气[\s\S]*持续10秒[\s\S]*不消耗精纯杀气[\s\S]*退出/);
  assert.match(saw.progressionNodes[0].description, /幽蓝侵蚀[\s\S]*削减更多杀气/);
  assert.match(saw.progressionNodes[2].description, /深红侵蚀[\s\S]*更多伤害/);
  assert.match(detail('tianxuan-qingtong-jian').mechanics.find((f) => f.valueText === '道法自然').description, /无法进行完美格挡/);
});

test('summon labels are admitted narrowly and remain invalid for ordinary weapons or unknown stat names', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-summon-stat-contract-'));
  try {
    await cp(join(root, 'data'), directory, { recursive: true });
    const summonFile = join(directory, 'weapons/kuye-si-zhuchuan.json');
    const summon = JSON.parse(await readFile(summonFile, 'utf8'));
    for (const [mutate, diagnostic] of [
      [(entity) => { entity.facts.find((f) => f.key === 'weapon.weaponType').value = '奇门'; }, /召唤物基础属性仅允许用于召唤类影之武装/],
      [(entity) => { entity.facts.find((f) => f.key === 'weapon.baseStat').value.statName = '召唤物破防'; }, /基础属性仅允许/]
    ]) {
      const entity = structuredClone(summon);
      mutate(entity);
      await writeFile(summonFile, JSON.stringify(entity));
      const result = spawnSync(process.execPath, [join(root, 'scripts/validate-data.mjs'), `--data-dir=${directory}`], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, diagnostic);
    }
    await writeFile(summonFile, JSON.stringify(summon));
    const ordinaryFile = join(directory, 'weapons/tianxuan-qingtong-jian.json');
    const ordinary = JSON.parse(await readFile(ordinaryFile, 'utf8'));
    ordinary.facts.find((f) => f.key === 'weapon.baseStat').value.statName = '召唤物生命';
    await writeFile(ordinaryFile, JSON.stringify(ordinary));
    const result = spawnSync(process.execPath, [join(root, 'scripts/validate-data.mjs'), `--data-dir=${directory}`], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /召唤物基础属性仅允许用于召唤类影之武装/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('five owner screenshot weapons reuse identities, separate Lv1 from unlocks and preserve evidence', async () => {
  const knowledge = await loadKnowledge();
  const source = knowledge.sourceById.get('source:owner-pc-release-weapons-2026-11-16');
  assert.equal(source.locator.evidenceItems.length, 16);
  assert.equal(new Set(source.locator.evidenceItems.map((item) => item.sha256)).size, 16);
  assert.equal(source.locator.capturedAt, null);
  assert.equal(source.locator.versionLabel, null);
  for (const [slug, name, system, category, damage, guard, mechanics] of [
    ['chizhe-canjian', '痴者残剑', '主武器', '单手武器', 228, 96, 4],
    ['wangming-zhanmadao', '亡命斩马刀', '主武器', '双手武器', 240, 106, 4],
    ['zhuobi-dun', '拙壁盾', '影之武装', '奇门', 226, 198, 3],
    ['tie-quantao', '铁拳套', '影之武装', '武学', 261, 223, 2],
    ['white-serpent-crimson-viper', '白蟒赤练', '主武器', '双持武器', 260, 110, 5]
  ]) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    const detail = projectWeaponDetail(entity, knowledge);
    assert.equal(entity.displayName, name);
    assert.equal(entity.slug, slug);
    assert.equal(detail.taxonomy.valueText, `${system} · ${category}`);
    assert.deepEqual(detail.overview.baseStats.map((f) => [f.value.displayedLevel, f.value.displayedValue]), [[1, damage], [1, guard]]);
    assert.deepEqual(detail.progressionNodes.map((f) => f.level), [5, 10, 15, 25]);
    assert.equal(detail.mechanics.length, mechanics);
    assert.equal(detail.overview.previewStats.length, 0);
    assert(!entity.facts.some((f) => f.key === 'weapon.acquisitionOrder'));
    assert(detail.sourceFacts.every((f) => f.status === 'observation' && f.sourceIds.includes(source.id)));
    assert.equal(getFact(entity, 'weapon.grip')?.value ?? null, system === '主武器' ? category.slice(0, 2) : null);
    const hero = await getProductionHeroMedia(entity.id);
    const card = await getProductionCardMedia(entity.id);
    assert.equal(hero.src, card.src);
    assert.deepEqual([hero.width, hero.height, hero.objectFit, hero.sourceId, hero.rightsStatus], [1200, 1800, 'contain', source.id, 'self-captured-reviewed']);
  }
  for (const slug of ['chizhe-canjian', 'white-serpent-crimson-viper']) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    const historical = entity.facts.filter((f) => f.gameVersionId.startsWith('version:prelaunch-'));
    assert(entity.aliases.length > 0);
    assert(historical.length > 0 && historical.every((f) => f.validToVersionId || f.supersededBy));
  }
  const detail = (slug) => projectWeaponDetail(knowledge.entityById.get(`weapon:${slug}`), knowledge);
  assert.match(detail('chizhe-canjian').mechanics[3].description, /消耗1精纯杀气[\s\S]*持续20秒[\s\S]*不消耗精纯杀气/);
  assert.match(detail('wangming-zhanmadao').mechanics[1].description, /12秒[\s\S]*临时损血变为实际损血/);
  assert.match(detail('wangming-zhanmadao').progressionNodes[2].description, /30%[\s\S]*10秒[\s\S]*60秒/);
  assert.match(detail('wangming-zhanmadao').progressionNodes[3].description, /血箭射出后，【紧急护盾】效果结束/);
  assert.match(detail('zhuobi-dun').mechanics[0].description, /持续消耗杀气[\s\S]*消耗1暗源/);
  assert.match(detail('tie-quantao').progressionNodes[2].description, /消耗1暗源[\s\S]*回复1暗源[\s\S]*增加2秒/);
  assert.match(detail('tie-quantao').progressionNodes[3].description, /下一套连招不消耗暗源/);
  assert.match(detail('white-serpent-crimson-viper').mechanics[4].description, /消耗1精纯杀气/);
  assert(!detail('white-serpent-crimson-viper').progressionNodes[0].description.includes('延长破防'));
});

test('withdrawn preview weapons stay draft while published Chinese names and historical aliases survive', async () => {
  const knowledge = await loadKnowledge();
  const published = getPublishedWeapons(knowledge);
  assert.equal(published.length, 26);
  for (const [slug, name] of [
    ['bashpole', 'Bashpole'], ['night-owl', 'Night Owl'], ['seamless-death', 'Seamless Death'],
    ['tang-hengdao', '唐横刀'], ['ya-hengdao', '牙横刀']
  ]) {
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

test('third owner screenshot batch preserves four Lv1 entries and the separately evidenced Lv24 weapon', async () => {
  const knowledge = await loadKnowledge();
  const source = 'source:owner-pc-release-weapons-2026-11-17-batch3';
  const version = 'version:release-pc-ui-2026-11-17-batch3';
  const evidence = knowledge.sourceById.get(source);
  assert.equal(evidence.locator.evidenceItems.length, 13);
  assert.equal(new Set(evidence.locator.evidenceItems.map((item) => item.sha256)).size, 13);
  assert.equal(evidence.locator.capturedAt, null);
  assert.equal(evidence.locator.versionLabel, null);
  for (const [slug, name, category, labels, values, level, nodes] of [
    ['huo-liuxing', '火流星', '影之武装 · 武学', ['伤害能力', '异常效果'], [380, 309], 1, [5, 10, 15, 25]],
    ['caoou-lingdang', '操偶铃铛', '影之武装 · 召唤', ['召唤物生命', '召唤物伤害'], [1911, 22], 1, [5, 10, 15, 25]],
    ['tan-lang', '贪狼', '影之武装 · 破坏', ['伤害能力', '破防能力'], [261, 280], 1, [null, 5, 10, 15, 25]],
    ['leiting-qiang', '雷霆枪', '影之武装 · 武学', ['伤害能力', '异常效果'], [450, 360], 1, [null, 5, 10, 15, 25]],
    ['tiansha-shuangyue', '天煞双钺', '主武器 · 双持武器', ['伤害能力', '破防能力'], [1030, 390], 24, [null, 5, 15, 20, 25]]
  ]) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    const detail = projectWeaponDetail(entity, knowledge);
    assert.equal(getPublishedWeapons(knowledge).filter((weapon) => weapon.displayName === name).length, 1);
    assert.equal(entity.recordState, 'published');
    assert.equal(detail.taxonomy.valueText, category);
    assert.deepEqual(entity.aliases, [], 'No English name may be inferred from a historical draft');
    assert.equal(getFact(entity, 'weapon.acquisitionOrder', knowledge), null);
    assert.deepEqual(detail.overview.baseStats.map((fact) => [fact.value.statName, fact.value.displayedValue, fact.value.displayedLevel]), labels.map((label, i) => [label, values[i], level]));
    assert.deepEqual(detail.progressionNodes.map((fact) => fact.level ?? null), nodes);
    assert(entity.facts.every((fact) => fact.status === 'observation' && fact.gameVersionId === version && fact.sourceIds.length === 1 && fact.sourceIds[0] === source));
    assert(entity.facts.every((fact) => fact.scope.platforms.mode === 'include' && fact.scope.platforms.ids.join(',') === 'platform:pc'));
    const hero = await getProductionHeroMedia(entity.id);
    const card = await getProductionCardMedia(entity.id);
    assert.deepEqual([hero.id, hero.width, hero.height, hero.objectFit, hero.sourceId, hero.rightsStatus], [card.id, 1200, 1800, 'contain', source, 'self-captured-reviewed']);
  }
});

test('third screenshot batch retains exact resources, summon restrictions and unlabelled growth without inferred levels', async () => {
  const knowledge = await loadKnowledge();
  const detail = (slug) => projectWeaponDetail(knowledge.entityById.get(`weapon:${slug}`), knowledge);
  const meteor = detail('huo-liuxing');
  assert.match(meteor.mechanics[0].description, /3段[\s\S]*一套连招消耗1暗源/);
  assert.equal(meteor.progressionNodes[0].valueText, '铁花飞溅');
  assert.match(meteor.mechanics[1].description, /降低其攻击力/);
  const summon = detail('caoou-lingdang');
  assert.match(summon.mechanics[0].description, /杀气浓郁[\s\S]*1名剑盾人偶及1名枪盾人偶[\s\S]*最多15秒[\s\S]*重复召唤[\s\S]*消耗2暗源/);
  assert.equal(summon.progressionNodes[3].valueText, '无意识强击');
  const club = detail('tan-lang');
  assert.match(club.mechanics[0].description, /人偶、金身、幻体无效[\s\S]*消耗1暗源/);
  assert.match(club.progressionNodes.find((fact) => fact.valueText === '全力一击').description, /不消耗暗源/);
  assert.match(club.progressionNodes.find((fact) => fact.valueText === '贪狼穿心').description, /12秒/);
  const spear = detail('leiting-qiang');
  assert.equal(spear.progressionNodes.find((fact) => fact.valueText === '雷枪突刺').input, 'Ⓛ + R1');
  const axes = detail('tiansha-shuangyue');
  assert.match(axes.mechanics.find((fact) => fact.valueText === '煞气').description, /20秒/);
  assert.match(axes.mechanics.find((fact) => fact.valueText === '天煞破敌').description, /消耗1精纯杀气/);
  assert.match(axes.progressionNodes.find((fact) => fact.valueText === '天煞双劫').description, /16秒/);
  assert.equal(axes.progressionNodes.find((fact) => fact.valueText === '群煞击').input, 'L1 + △');
  assert.match(axes.progressionNodes.find((fact) => fact.valueText === '群煞击').description, /消耗全部煞气/);
  assert(!axes.progressionNodes.some((fact) => fact.level === 10 || fact.level === 30), 'Unseen Lv10 and next-tier Lv30 effects must not be inferred');
  for (const [slug, name] of [['tan-lang', '鬼火缠身'], ['leiting-qiang', '连环惊雷'], ['tiansha-shuangyue', '天煞双劫']]) {
    const fact = knowledge.entityById.get(`weapon:${slug}`).facts.find((item) => item.key === 'weapon.progressionNode' && item.value.name === name);
    assert(!Object.hasOwn(fact.value, 'level'), 'Unlabelled growth must not be assigned Lv1');
  }
});

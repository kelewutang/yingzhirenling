import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKnowledge } from '../src/lib/knowledge.mjs';
import { projectWeaponDetail, projectWeaponPublicContent, projectWeaponFormDetails } from '../src/lib/projections.mjs';
import { validateWeaponForms } from '../src/lib/weapon-forms.mjs';
import { pcDetailsSourceId, pcDetailsVersionId } from '../src/lib/weapon-pc-details.mjs';

const targets = [
  ['white-shadow', '双手武器', [1200, 562], '雪上加霜'],
  ['soft-snake-sword', '单手武器', [1123, 459], '孤注一掷']
];
for (const [slug, type, stats, effectName] of targets) {
  test(`${slug}: current PC evidence replaces historical summaries without reviving ended kind`, async () => {
    const knowledge = await loadKnowledge(), entity = knowledge.entityById.get(`weapon:${slug}`);
    const kind = entity.facts.find((fact) => fact.key === 'weapon.kind');
    assert.equal(kind.validToVersionId, 'version:release-pc-ui-2026-10-29');
    assert(!kind.sourceIds.includes(pcDetailsSourceId));
    assert(!entity.summaryFactIds.includes(kind.id));
    const detail = projectWeaponDetail(entity, knowledge);
    assert.equal(detail.taxonomy.valueText, `主武器 · ${type}`);
    assert.deepEqual(detail.overview.baseStats.map((fact) => fact.value.displayedValue), stats);
    assert(detail.overview.baseStats.every((fact) => fact.value.displayedLevel === 30));
    assert.deepEqual(detail.overview.previewStats, []);
    assert.deepEqual(detail.progressionNodes.map((fact) => fact.level), [5, 15, 25, 30]);
    assert.equal(detail.soulForgeEffects.length, 1);
    const effect = detail.soulForgeEffects[0];
    assert.equal(effect.valueText, effectName);
    assert.equal(effect.level, null);
    assert(!detail.progressionNodes.some((fact) => fact.id === effect.id));
    assert.equal(projectWeaponFormDetails(entity, knowledge), null);
    assert.equal(projectWeaponPublicContent(entity, knowledge).summary, entity.summary);
    const changed = structuredClone(entity);
    changed.summary = 'Unreviewed arbitrary prose';
    assert.equal(projectWeaponPublicContent(changed, knowledge).summary, entity.summary);
    changed.summaryFactIds = [kind.id];
    assert.equal(projectWeaponPublicContent(changed, knowledge).summary, '武器介绍待补充');
  });
  for (const [label, mutate] of [
    ['changed amount', ({ entity }) => { entity.facts.find((fact) => fact.gameVersionId === pcDetailsVersionId && fact.sourceIds.length === 2).value.description = '消耗2精纯杀气'; }],
    ['missing terminology confirmation', ({ entity }) => { entity.facts.find((fact) => fact.gameVersionId === pcDetailsVersionId && fact.sourceIds.length === 2).sourceIds.pop(); }],
    ['ended effect', ({ entity }) => { entity.facts.find((fact) => fact.key === 'weapon.soulForgeEffect').validToVersionId = pcDetailsVersionId; }],
    ['missing effect binding', ({ source }) => { source.locator.weaponEffects = []; }],
    ['wrong effect version', ({ source }) => { source.locator.weaponEffects[0].gameVersionId = 'version:prelaunch-demo-2025'; source.locator.weaponEffects[1].gameVersionId = 'version:prelaunch-demo-2025'; }],
    ['foreign screenshot', ({ source }) => { source.locator.evidenceItems.forEach((item) => { item.weaponId = 'weapon:other'; }); }],
    ['bad screenshot hash', ({ source }) => { source.locator.evidenceItems.forEach((item) => { item.sha256 = 'unknown'; }); }],
    ['missing claim', ({ source }) => { source.locator.weaponClaims = []; }],
    ['invalid evidence position', ({ source }) => { source.locator.weaponClaims.forEach((claim) => { claim.locations[0].position = 1; }); }],
    ['wrong platform', ({ entity }) => { entity.facts.find((fact) => fact.key === 'weapon.soulForgeEffect').scope.platforms.ids = ['platform:playstation-5']; }],
    ['statement used as effect evidence', ({ entity }) => { entity.facts.find((fact) => fact.key === 'weapon.soulForgeEffect').sourceIds = ['source:owner-pc-baiying-lingshe-resource-2026-11-23']; }],
    ['archived source', ({ source }) => { source.recordState = 'archived'; }],
    ['missing version', ({ knowledge }) => { knowledge.versionById.delete(pcDetailsVersionId); }],
    ['unverified status', ({ entity }) => { entity.facts.find((fact) => fact.key === 'weapon.soulForgeEffect').status = 'pending-review'; }],
    ['invented form', ({ entity }) => { entity.facts.push({ ...entity.facts.at(-1), id: 'fact:fixture:form', key: 'weapon.formSet', value: {} }); }],
    ['invented growth level on effect', ({ entity }) => { entity.facts.find((fact) => fact.key === 'weapon.soulForgeEffect').value.level = 30; }]
  ]) {
    test(`${slug}: rejects ${label}`, async () => {
      const knowledge = structuredClone(await loadKnowledge());
      const entity = knowledge.entityById.get(`weapon:${slug}`), source = knowledge.sourceById.get(pcDetailsSourceId);
      mutate({ knowledge, entity, source });
      assert(validateWeaponForms(entity, knowledge).length > 0);
    });
  }
}

test('seven original screenshot records keep separate terminology, quantity and independent effect references', async () => {
  const knowledge = await loadKnowledge(), source = knowledge.sourceById.get(pcDetailsSourceId);
  assert.equal(source.locator.evidenceItems.length, 7);
  assert.equal(new Set(source.locator.evidenceItems.map((item) => item.sha256)).size, 7);
  assert.equal(source.locator.capturedAt, null);
  assert.equal(source.locator.versionLabel, null);
  assert.equal(source.locator.weaponEffects.length, 2);
  for (const slug of targets.map(([slug]) => slug)) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    assert.deepEqual(validateWeaponForms(entity, knowledge), []);
    const fact = entity.facts.find((fact) => fact.gameVersionId === pcDetailsVersionId && fact.sourceIds.length === 2);
    const claim = source.locator.weaponClaims.find((claim) => claim.factId === fact.id);
    assert(claim.value.description.includes('消耗1［紫色图标］'));
    assert(fact.value.description.includes('消耗1精纯杀气'));
    assert(!fact.value.description.includes('1点'));
  }
  const shadow = projectWeaponDetail(knowledge.entityById.get('weapon:white-shadow'), knowledge);
  assert(!shadow.progressionNodes.find((fact) => fact.level === 25).description.includes('延长'));
  const snake = projectWeaponDetail(knowledge.entityById.get('weapon:soft-snake-sword'), knowledge);
  assert(snake.progressionNodes.find((fact) => fact.level === 25).description.includes('25%'));
  assert(snake.soulForgeEffects[0].description.includes('全部杀气'));
});

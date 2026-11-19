import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { weaponFormsFixture } from './fixtures/weapon-forms.mjs';
import { validateWeaponForms, resolveWeaponForms, searchableForgedNames } from '../src/lib/weapon-forms.mjs';
import { projectWeaponDetail, projectWeaponFormDetails } from '../src/lib/projections.mjs';
import { loadKnowledge, getPublishedWeapons } from '../src/lib/knowledge.mjs';
import { getProductionHeroMedia, getProductionCardMedia } from '../src/lib/media.mjs';

const targetPairs = [['heishang', '黑伤', '黑魔伤'], ['heishang-shuangren', '黑伤双刃', '绝影'], ['changxing-heishang', '长形黑伤', '炽刃'], ['luanying-jian', '乱莺剑', '天邈·乱莺']];
test('four renames retain canonical IDs, slugs and 26 published weapons; no typo alias', async () => {
  const k = await loadKnowledge(); assert.equal(getPublishedWeapons(k).length, 26);
  for (const [slug, original, forged] of targetPairs) {
    const entity = k.entityById.get(`weapon:${slug}`);
    assert.equal(entity.displayName, original); assert.equal(entity.slug, slug);
    assert.deepEqual(searchableForgedNames(entity), [forged]);
    assert.equal(resolveWeaponForms(entity), null); // Incomplete screenshot evidence must not generate a fake switch.
    assert(!entity.aliases.some((alias) => alias.value.includes('长型黑伤')));
    assert.deepEqual(validateWeaponForms(entity, k), []);
  }
});
test('four reviewed forged appearances keep base Hero/Card and independent screenshot evidence', async () => {
  const k = await loadKnowledge();
  for (const [slug, , name] of targetPairs) {
    const entity = k.entityById.get(`weapon:${slug}`);
    const base = await getProductionHeroMedia(entity.id, entity);
    const card = await getProductionCardMedia(entity.id, entity);
    const forged = await getProductionHeroMedia(entity.id, entity, 'soulForged');
    assert.equal(base.id, `media:${slug}-master`);
    assert.equal(card.id, base.id);
    assert.equal(forged.id, `media:${slug}-soul-forged-master`);
    assert.equal(forged.weaponForm, 'soulForged');
    assert.notEqual(forged.src, base.src);
    assert(forged.alt.includes(name));
    assert.equal(forged.width, 1200); assert.equal(forged.height, 1800);
    assert.equal(forged.rightsStatus, 'self-captured-reviewed');
    const source = k.sourceById.get(forged.sourceId);
    assert.equal(source.locator.type, 'user-supplied-game-screenshot');
    assert(source.locator.evidenceItems.some((item) => forged.processing.includes(item.sha256)));
    assert.equal(resolveWeaponForms(entity), null);
    assert.equal(await getProductionHeroMedia(entity.id, { ...entity, spoilerLevel: 'major' }, 'soulForged'), null);
  }
  assert.equal(await getProductionHeroMedia('weapon:white-shadow', k.entityById.get('weapon:white-shadow'), 'soulForged'), null);
});
test('full explicit fixture validates; both forms retain identity and each independent media/name', () => {
  const { entity, knowledge } = weaponFormsFixture();
  assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  const { forms } = resolveWeaponForms(entity);
  assert.equal(forms.base.name, 'Base fixture'); assert.equal(forms.soulForged.name, 'Forged fixture');
  assert.notEqual(forms.base.mediaId, forms.soulForged.mediaId);
  assert.equal(forms.base.entity.id, forms.soulForged.entity.id); assert.equal(forms.base.entity.slug, forms.soulForged.entity.slug);
});
test('shared/modified/added/removed moves and nodes use stable IDs even with identical labels', () => {
  const { entity, knowledge } = weaponFormsFixture(), result = projectWeaponFormDetails(entity, knowledge);
  for (const field of ['mechanics', 'progressionNodes']) {
    const base = result.forms.base.detail[field], forged = result.forms.soulForged.detail[field];
    assert.equal(base.length, 3); assert.equal(forged.length, 3);
    assert.equal(base[0].id, forged[0].id); assert.notEqual(base[1].id, forged[1].id);
    assert.equal(forged[1].formChange, 'modified'); assert.equal(forged[2].formChange, 'added');
    assert(!forged.some((f) => f.id === base[2].id));
    assert.equal(base[1].valueText, forged[1].valueText);
    assert.equal(base[1].input, 'L2'); assert.equal(forged[1].input, 'L2');
  }
  assert.deepEqual(result.forms.base.detail.progressionNodes.map((f) => f.level), [5, 10, 25]);
  assert.deepEqual(result.forms.soulForged.detail.progressionNodes.map((f) => f.level), [5, 10, null]);
});
test('different displayed weapon levels stay explicit; effect only belongs to forged form', () => {
  const { entity, knowledge } = weaponFormsFixture(), { forms } = projectWeaponFormDetails(entity, knowledge);
  assert.equal(forms.base.detail.overview.baseStats[0].value.displayedLevel, 1);
  assert.equal(forms.soulForged.detail.overview.baseStats[0].value.displayedLevel, 5);
  assert.equal(forms.base.detail.soulForgeEffects.length, 0); assert.equal(forms.soulForged.detail.soulForgeEffects.length, 1);
  assert(!forms.soulForged.detail.progressionNodes.some((f) => f.key === 'weapon.soulForgeEffect'));
  assert.deepEqual(projectWeaponDetail(entity, knowledge), forms.base.detail);
});
const invalid = {
  'foreign Fact reference': ({ entity }) => { entity.facts.at(-1).value.base.nameFactId = 'fact:weapon:other:name'; },
  'missing Source': ({ knowledge }) => { knowledge.sourceById.clear(); },
  'missing version': ({ knowledge }) => { knowledge.versionById.clear(); },
  'invalid Media ID': ({ entity }) => { entity.facts.at(-1).value.soulForged.mediaId = 'media:absent'; },
  'base image reused': ({ knowledge }) => { knowledge.mediaRecords[1].src = knowledge.mediaRecords[0].src; },
  'wrong Media form': ({ knowledge }) => { knowledge.mediaRecords[1].weaponForm = 'base'; },
  'draft Media': ({ knowledge }) => { knowledge.mediaRecords[1].recordState = 'draft'; },
  'foreign Media': ({ knowledge }) => { knowledge.mediaRecords[1].entityId = 'weapon:other'; },
  'unreviewed Media': ({ knowledge }) => { knowledge.mediaRecords[1].rightsStatus = 'review-required'; },
  'implicit name-matched shared skill': ({ entity }) => { const item = entity.facts.at(-1).value.mechanics[1]; item.change = 'shared'; },
  'implicit level-matched shared node': ({ entity }) => { entity.facts.at(-1).value.progressionNodes[1].change = 'shared'; },
  'repeated logical identity': ({ entity }) => { const rows = entity.facts.at(-1).value.mechanics; rows[1].logicalId = rows[0].logicalId; },
  'same fact under different logical identities': ({ entity }) => { const rows = entity.facts.at(-1).value.mechanics; rows[1] = { ...rows[0], logicalId: 'another' }; },
  'unmapped original skill': ({ entity }) => { entity.facts.at(-1).value.mechanics.pop(); },
  'inferred new skill': ({ entity }) => { entity.facts.at(-1).value.mechanics[2].baseFactId = 'invalid'; },
  'mixed displayed levels within form': ({ entity }) => { const value = entity.facts.at(-1).value; value.base.baseStatFactIds.push(...value.soulForged.baseStatFactIds); },
  'effect with invented unlock level': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.soulForgeEffect').value.level = 25; },
  'conflicting current effect': ({ entity }) => { entity.facts.push({ ...structuredClone(entity.facts.find((f) => f.key === 'weapon.soulForgeEffect')), id: 'fact:weapon:fixture-soul:second-effect' }); },
  'major skill downgraded': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').spoilerLevel = 'major'; },
  'major Media downgraded': ({ knowledge }) => { knowledge.mediaRecords[1].spoilerLevel = 'major'; },
  'pending technical Fact': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').status = 'pending-review'; },
  'incompatible platform': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').scope.platforms.ids = ['platform:playstation-5']; },
  'future Fact': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').validFromVersionId = 'version:fixture-v3'; },
  'ended Fact': ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').validToVersionId = 'version:fixture-v2'; },
  'Owner naming statement used for technical evidence': ({ knowledge }) => { knowledge.sourceById.get('source:fixture-screenshot').locator.type = 'user-supplied-statement'; }
};
for (const [label, mutate] of Object.entries(invalid)) test(`rejects ${label}`, () => {
  const fixture = weaponFormsFixture(); mutate(fixture);
  assert(validateWeaponForms(fixture.entity, fixture.knowledge).length, label);
});
test('historical and disjoint-scope effects do not conflict, overlapping current versions do', () => {
  const fixture = weaponFormsFixture(), { entity, knowledge } = fixture;
  const effect = structuredClone(entity.facts.find((f) => f.key === 'weapon.soulForgeEffect'));
  effect.id += '-historical'; effect.gameVersionId = 'version:fixture-v1'; effect.validFromVersionId = 'version:fixture-v1'; effect.validToVersionId = 'version:fixture-v2';
  entity.facts.push(effect); assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  effect.validToVersionId = null; effect.scope.platforms.ids = ['platform:playstation-5']; assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  effect.scope.platforms.ids = ['platform:pc']; assert(validateWeaponForms(entity, knowledge).some((e) => e.includes('conflicting')));
});
test('Draft, archived, major, pending and ended names never leak to Search', () => {
  for (const variant of ['draft', 'archived', 'major-entity', 'major-fact', 'pending', 'ended', 'superseded']) {
    const { entity } = weaponFormsFixture(), name = entity.facts.find((f) => f.key === 'weapon.soulForgedName');
    if (['draft', 'archived'].includes(variant)) entity.recordState = variant;
    if (variant === 'major-entity') entity.spoilerLevel = 'major';
    if (variant === 'major-fact') name.spoilerLevel = 'major';
    if (variant === 'pending') name.status = 'pending-review';
    if (variant === 'ended') name.validToVersionId = 'version:fixture-v2';
    if (variant === 'superseded') name.supersededBy = 'another';
    assert.deepEqual(searchableForgedNames(entity), [], variant);
  }
});
test('production data validator rejects injected cross-entity form references and non-name Owner statements', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-soul-negative-'));
  try {
    await cp(new URL('../data/', import.meta.url), join(directory, 'data'), { recursive: true });
    const path = join(directory, 'data/weapons/heishang.json'), weapon = JSON.parse(await readFile(path, 'utf8'));
    weapon.facts.at(-1).key = 'weapon.mechanic'; weapon.facts.at(-1).valueType = 'object'; weapon.facts.at(-1).value = { name: 'Fake skill', description: 'Not permitted' };
    await writeFile(path, JSON.stringify(weapon));
    const result = spawnSync(process.execPath, ['scripts/validate-data.mjs', `--data-dir=${join(directory, 'data')}`], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Owner naming confirmation cannot verify technical Facts/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { weaponFormsFixture, partialWeaponFormsFixture } from './fixtures/weapon-forms.mjs';
import { assertPublishableWeaponForms, validateWeaponForms, searchableForgedNames } from '../src/lib/weapon-forms.mjs';
import { projectWeaponDetail, projectWeaponFormDetails, projectWeaponPublicContent } from '../src/lib/projections.mjs';
import { loadKnowledge, getPublishedWeapons } from '../src/lib/knowledge.mjs';
import { getProductionHeroMedia, getProductionCardMedia } from '../src/lib/media.mjs';
import { buildSearchDocuments } from '../scripts/build-search-index.mjs';
const weaponSummaryFallback = '武器介绍待补充';

const targetPairs = [['heishang', '黑伤', '黑魔伤'], ['heishang-shuangren', '黑伤双刃', '绝影'], ['changxing-heishang', '长形黑伤', '炽刃'], ['luanying-jian', '乱莺剑', '天邈·乱莺']];
test('four renames retain canonical IDs, slugs and 26 published weapons; no typo alias', async () => {
  const k = await loadKnowledge(); assert.equal(getPublishedWeapons(k).length, 26);
  for (const [slug, original, forged] of targetPairs) {
    const entity = k.entityById.get(`weapon:${slug}`);
    assert.equal(entity.displayName, original); assert.equal(entity.slug, slug);
    assert.deepEqual(searchableForgedNames(entity, k), [forged]);
    assert.doesNotThrow(() => assertPublishableWeaponForms(entity, k));
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
    assert.equal(await getProductionHeroMedia(entity.id, { ...entity, spoilerLevel: 'major' }, 'soulForged'), null);
  }
  assert.equal(await getProductionHeroMedia('weapon:white-shadow', k.entityById.get('weapon:white-shadow'), 'soulForged'), null);
});
const soulBatchVersion = 'version:release-pc-soul-forms-2026-11-23';
const soulBatchSource = 'source:owner-pc-soul-forms-2026-11-23';
const evidenceRequired = /cannot publish soulForged technical Facts without entity\/form\/Fact\/version evidence/;

test('the frozen formSet shape validates privately but has no technical publication path', () => {
  const { entity, knowledge } = weaponFormsFixture();
  assert.deepEqual(validateWeaponForms({ ...entity, recordState: 'draft' }, knowledge), []);
  assert.equal(projectWeaponFormDetails({ ...entity, recordState: 'draft' }, knowledge), null);
  assert.match(validateWeaponForms(entity, knowledge).join('\n'), evidenceRequired);
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), evidenceRequired);
  assert.throws(() => projectWeaponDetail(entity, knowledge), evidenceRequired);
});
test('published forms expose only their own screenshot-backed technical Facts', async () => {
  const knowledge = await loadKnowledge();
  const media = JSON.parse(await readFile(new URL('../data/media.json', import.meta.url))).records;
  for (const [slug, original, forged] of targetPairs) {
    const entity = knowledge.entityById.get(`weapon:${slug}`);
    const forms = projectWeaponFormDetails(entity, knowledge, media);
    assert.equal(forms.forms.base.name, original); assert.equal(forms.forms.soulForged.name, forged);
    assert.equal(forms.forms.base.mediaId, `media:${slug}-master`);
    assert.equal(forms.forms.soulForged.mediaId, `media:${slug}-soul-forged-master`);
    assert.deepEqual(forms.forms.base.detail, projectWeaponDetail(entity, knowledge));
    const soul = forms.forms.soulForged;
    const expected = {
      heishang: [['伤害能力', 1264], ['破防能力', 468]],
      'heishang-shuangren': [['伤害能力', 1264], ['破防能力', 468]],
      'changxing-heishang': [['伤害能力', 1217], ['异常效果', 513]],
      'luanying-jian': [['伤害能力', 1095], ['破防能力', 428]]
    };
    assert.deepEqual(soul.detail.overview.baseStats.map(({ value }) => [value.statName, value.displayedValue]), expected[slug]);
    assert(soul.detail.overview.baseStats.every(({ value }) => value.displayedLevel === 30));
    assert.deepEqual(soul.detail.progressionNodes.map(({ level }) => level), [5, 15, 25, 30]);
    assert.deepEqual(soul.detail.mechanics.slice(0, 2).map(({ valueText }) => valueText), ['普通连招', '杀气连招']);
    assert(soul.detail.mechanics.length >= 4);
    assert(soul.entity.facts.every(({ gameVersionId }) => gameVersionId === soulBatchVersion));
    assert(forms.forms.base.entity.facts.every(({ gameVersionId }) => gameVersionId !== soulBatchVersion));
    assert.equal(soul.pendingTechnicalDetails, false);
    assert.equal(soul.description.key, 'weapon.description');
    assert.equal(forms.forms.base.pendingTechnicalDetails, false);
    assert.equal(soul.entity.id, entity.id); assert.equal(soul.entity.slug, entity.slug);
    assert.equal(projectWeaponFormDetails({ ...entity, recordState: 'draft' }, knowledge, media), null);
    assert.equal(projectWeaponFormDetails({ ...entity, spoilerLevel: 'major' }, knowledge, media), null);
  }
  assert.equal(projectWeaponFormDetails(knowledge.entityById.get('weapon:white-shadow'), knowledge, media), null);
});
test('rejects the R4 partial-form shape in validation and projection', () => {
  const { entity, knowledge } = partialWeaponFormsFixture();
  const errors = validateWeaponForms(entity, knowledge);
  assert(errors.some((error) => error.includes('invalid soulForged')));
  assert(errors.some((error) => error.includes('invalid explicit unverified mapping')));
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), /invalid explicit unverified mapping/);
});

for (const [label, mutate, diagnostic] of [
  ['empty description', (value) => { value.base.descriptionFactId = null; }, /invalid own-entity weapon.description reference/],
  ['empty stats', (value) => { value.base.baseStatFactIds = []; }, /explicit base stats required/],
  ['empty effect', (value) => { value.effectFactId = null; }, /invalid own-entity weapon.soulForgeEffect reference/],
  ['empty mapping', (value) => { value.mechanics = []; }, /explicit mechanics mappings required/],
  ['extra completeness', (value) => { value.base.completeness = { description: 'pending' }; }, /invalid base/],
  ['unverified mapping', (value) => { value.mechanics.at(-1).change = 'unverified'; }, /invalid explicit unverified mapping/],
  ['null mapping', (value) => { value.mechanics.push(null); }, /invalid\/repeated logical identity/]
]) test(`rejects frozen form-set violation: ${label}`, () => {
  const { entity, knowledge } = weaponFormsFixture();
  mutate(entity.facts.at(-1).value);
  const errors = validateWeaponForms(entity, knowledge);
  assert.match(errors.join('\n'), diagnostic);
  assert.deepEqual(validateWeaponForms(entity, knowledge), errors);
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), diagnostic);
});

test('retagging a base-only move or progression node, with or without unrelated co-citations, is rejected', () => {
  for (const field of ['mechanics', 'progressionNodes']) {
    const { entity, knowledge } = weaponFormsFixture();
    const row = entity.facts.at(-1).value[field].find((mapping) => mapping.change === 'removed');
    const fact = entity.facts.find((item) => item.id === row.baseFactId);
    Object.assign(row, { change: 'added', baseFactId: null, soulForgedFactId: fact.id });
    assert.match(validateWeaponForms(entity, knowledge).join('\n'), evidenceRequired);
    fact.sourceIds.push('source:fixture-forged-screenshot', 'source:fixture-soul-gameplay');
    assert.match(validateWeaponForms(entity, knowledge).join('\n'), evidenceRequired);
    assert.throws(() => projectWeaponFormDetails(entity, knowledge), evidenceRequired);
  }
});

test('standalone effects cannot bypass the formSet publication block', () => {
  const { entity, knowledge } = weaponFormsFixture();
  entity.facts.pop();
  assert.match(validateWeaponForms(entity, knowledge).join('\n'), evidenceRequired);
  assert.throws(() => projectWeaponDetail(entity, knowledge), evidenceRequired);
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), evidenceRequired);
});

for (const [label, sourceIds, diagnostic] of [
  ['missing shared-skill Source', [], 'missing Source'],
  ['unregistered gameplay Source', ['source:fixture-screenshot', 'source:fixture-forged-screenshot', 'source:absent'], 'missing Source'],
  ['base and gameplay Sources only', ['source:fixture-screenshot', 'source:fixture-soul-gameplay']],
  ['appearance-only Source', ['source:fixture-forged-screenshot']],
  ['forged-only evidence on a shared skill', ['source:fixture-forged-screenshot', 'source:fixture-soul-gameplay']]
]) test(`checks Source attribution independently: ${label}`, () => {
  const { entity, knowledge } = weaponFormsFixture();
  const fact = entity.facts.find((item) => item.id.endsWith(':move-shared-base'));
  const set = entity.facts.at(-1);
  fact.sourceIds = sourceIds;
  const privateErrors = validateWeaponForms({ ...entity, recordState: 'draft' }, knowledge);
  assert.deepEqual(privateErrors, diagnostic ? [`${entity.id}: ${fact.id}: ${diagnostic}`] : []);
  const publicErrors = validateWeaponForms(entity, knowledge).filter((error) => error.startsWith(`${entity.id}: ${set.id}:`));
  assert.equal(publicErrors.length, 1);
  assert.match(publicErrors[0], evidenceRequired);
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), evidenceRequired);
});

test('the same appearance Source cannot provide technical evidence for both weapon forms', () => {
  const { entity, knowledge } = weaponFormsFixture();
  knowledge.mediaRecords[1].sourceId = knowledge.mediaRecords[0].sourceId;
  const draft = { ...entity, recordState: 'draft' };
  assert.deepEqual(validateWeaponForms(draft, knowledge), [], 'distinct private images may have a common Source');
  assert.throws(() => projectWeaponFormDetails(entity, knowledge), evidenceRequired);
  knowledge.mediaRecords[1].src = knowledge.mediaRecords[0].src;
  assert.equal(validateWeaponForms(draft, knowledge).length, 1);
  assert.match(validateWeaponForms(draft, knowledge)[0], /forged appearance cannot reuse base image/);
});

test('the public introduction selects the same current Fact and honors review status in either form', () => {
  const { entity, knowledge } = weaponFormsFixture();
  const descriptions = entity.facts.filter((fact) => fact.key === 'weapon.description');
  assert.equal(descriptions.length, 2);
  for (const original of descriptions) {
    const fixture = { ...entity, facts: [
      { ...original, id: original.id + '-old', checkedAt: '2026-11-01' },
      { ...original }
    ] };
    const selected = fixture.facts[1];
    for (const status of ['pending-review', 'editorial']) {
      selected.status = status;
      assert.equal(projectWeaponPublicContent(fixture, knowledge).description, null);
    }
    selected.status = 'observation';
    selected.spoilerLevel = 'major';
    assert.deepEqual(projectWeaponPublicContent(fixture, knowledge).description, { id: selected.id, value: selected.value, spoilerLevel: 'major' });
    selected.validToVersionId = 'version:fixture-v3';
    assert.equal(projectWeaponPublicContent(fixture, knowledge).description.id, selected.id + '-old');
  }
});

test('Unicode-equivalent withheld descriptions fall back consistently in page projections and published weapon Search', async () => {
  const knowledge = await loadKnowledge();
  const records = JSON.parse(await readFile(new URL('../data/media.json', import.meta.url))).records;
  for (const status of ['pending-review', 'editorial']) {
    const entity = structuredClone(knowledge.entityById.get('weapon:luanying-jian'));
    entity.facts = entity.facts.filter((fact) => fact.gameVersionId !== soulBatchVersion);
    const fact = entity.facts.find((item) => item.key === 'weapon.description');
    fact.status = status;
    fact.value = 'ＩＲ合成介绍　只供私有核验';
    const search = (record, mode = 'production') => buildSearchDocuments([
      { entity: record, file: 'r6-fixture.json' }
    ], mode, new Set([record.slug]), knowledge).documents[0]?.summary;
    entity.summaryFactIds = [...new Set([...entity.summaryFactIds, fact.id])];
    entity.summary = 'Unreviewed free text';
    assert.equal(projectWeaponPublicContent(entity, knowledge).summary, '武器介绍待补充', 'withheld supporting Fact');
    entity.summaryFactIds = entity.summaryFactIds.filter((id) => id !== fact.id);
    for (const separator of [' ', '\u00a0', '\u202f', '\u3000', '\u200b', '\r\n']) {
      entity.summary = '摘录：IR合成介绍' + separator + '只供私有核验';
      assert.equal(projectWeaponPublicContent(entity, knowledge).summary, '武器介绍待补充');
      assert.equal(search(entity), '武器介绍待补充');
      assert.equal(search(entity, 'shadow'), '武器介绍待补充');
      assert.equal(search({ ...entity, recordState: 'draft' }, 'shadow'), entity.summary);
      assert.equal(search({ ...entity, entityType: 'character' }), entity.summary);
      const { forms } = projectWeaponFormDetails(entity, knowledge, records);
      assert.equal(forms.base.description, null);
      assert.equal(forms.soulForged.description, null);
    }
    entity.summary = 'Unreviewed free text';
    assert.equal(projectWeaponPublicContent(entity, knowledge).summary, weaponSummaryFallback);
    assert.equal(search(entity), weaponSummaryFallback);
  }
});

for (const slug of ['white-shadow', 'soft-snake-sword']) {
  test(`historical summary compatibility is limited to the exact ${slug} record`, async () => {
    const knowledge = await loadKnowledge();
    const original = knowledge.entityById.get(`weapon:${slug}`);
    const readSummary = (entity, sources = knowledge) => projectWeaponPublicContent(entity, sources).summary;
    const kind = original.facts.find((fact) => fact.key === 'weapon.kind');
    assert.equal(kind.validToVersionId, 'version:release-pc-ui-2026-10-29');
    const changes = [
      (weapon) => { weapon.summary += ' '; },
      (weapon) => { weapon.summary = weapon.summary.slice(0, -2); },
      (weapon) => { weapon.id = 'weapon:other'; },
      (weapon) => { weapon.slug = 'other'; },
      (weapon) => { weapon.recordState = 'draft'; },
      (weapon) => { weapon.spoilerLevel = 'major'; },
      (weapon) => { weapon.summaryFactIds.pop(); },
      (weapon) => { weapon.summaryFactIds.push(weapon.summaryFactIds[0]); },
      (weapon) => { weapon.summaryFactIds.push('fact:weapon:other:kind'); },
      (weapon) => { weapon.facts = weapon.facts.filter((fact) => fact.id !== kind.id); },
      (weapon) => { weapon.facts.find((fact) => fact.id === kind.id).validToVersionId = null; },
      (weapon) => { weapon.facts.find((fact) => fact.id === kind.id).gameVersionId = kind.validToVersionId; },
      (weapon) => { weapon.facts.find((fact) => fact.id === kind.id).sourceIds = []; }
    ];
    for (const mutate of changes) {
      const entity = structuredClone(original);
      mutate(entity);
      assert.equal(readSummary(entity), weaponSummaryFallback, mutate.toString());
    }
    const changedVersion = new Map(knowledge.versionById);
    changedVersion.delete(kind.validToVersionId);
    assert.equal(readSummary(original, { ...knowledge, versionById: changedVersion }), weaponSummaryFallback);
    changedVersion.set(kind.validToVersionId, { ...knowledge.versionById.get(kind.validToVersionId), sequence: 999 });
    assert.equal(readSummary(original, { ...knowledge, versionById: changedVersion }), weaponSummaryFallback);
    const changedSource = new Map(knowledge.sourceById);
    const [sourceId] = kind.sourceIds;
    changedSource.set(sourceId, { ...changedSource.get(sourceId), checkedAt: '2026-11-23' });
    assert.equal(readSummary(original, { ...knowledge, sourceById: changedSource }), weaponSummaryFallback);
    assert.equal(kind.validToVersionId, 'version:release-pc-ui-2026-10-29');
  });
}

test('supported release summary composition ignores free text and needs a shared source and version', async () => {
  const knowledge = await loadKnowledge();
  const entity = structuredClone(knowledge.entityById.get('weapon:heishang'));
  const originalSummary = entity.summary;
  entity.summary = 'Private arbitrary text';
  assert.equal(projectWeaponPublicContent(entity, knowledge).summary, originalSummary);
  const grip = entity.facts.find((fact) => fact.key === 'weapon.grip');
  const { gameVersionId, sourceIds } = grip;
  grip.sourceIds = ['source:owner-pc-release-weapons-2026-11-16-batch2'];
  assert.equal(projectWeaponPublicContent(entity, knowledge).summary, weaponSummaryFallback);
  grip.sourceIds = sourceIds;
  grip.gameVersionId = 'version:release-pc-ui-2026-11-16-batch2';
  assert.notEqual(grip.gameVersionId, gameVersionId);
  assert.equal(projectWeaponPublicContent(entity, knowledge).summary, weaponSummaryFallback);
});

test('unreviewed overview and technical prose do not survive a four-weapon projection', async () => {
  const knowledge = await loadKnowledge();
  const entity = structuredClone(knowledge.entityById.get('weapon:heishang'));
  const description = entity.facts.find((fact) => fact.key === 'weapon.description');
  const trait = { ...description, id: 'fixture-editorial-trait', key: 'weapon.observedTrait', status: 'editorial' };
  const pending = { ...entity.facts.find((fact) => fact.key === 'weapon.mechanic'),
    id: 'fixture-pending-skill', status: 'pending-review' };
  entity.facts.push(trait, pending);
  entity.summary = trait.value;
  entity.summaryFactIds = [trait.id];
  assert.equal(projectWeaponPublicContent(entity, knowledge).summary, weaponSummaryFallback);
  const detail = projectWeaponDetail(entity, knowledge);
  assert(!detail.overview.notes.some((fact) => fact.id === trait.id));
  assert(!detail.mechanics.some((fact) => fact.id === pending.id));
  assert(detail.mechanics.length > 0);
});

test('appearance-only projection rejects draft, concealed, unreviewed, foreign and statement-backed Media', async () => {
  const knowledge = await loadKnowledge(), entity = knowledge.entityById.get('weapon:heishang');
  const records = JSON.parse(await readFile(new URL('../data/media.json', import.meta.url))).records;
  for (const overrides of [{ recordState: 'draft' }, { rightsStatus: 'review-required' }, { entityId: 'weapon:other' }, { weaponForm: 'base' }, { spoilerLevel: 'major' }, { sourceId: 'source:owner-weapon-soul-names-2026-11-18' }, { src: 'heishang-master.jpg' }]) {
    const changed = records.map((item) => item.id === 'media:heishang-soul-forged-master' ? { ...item, ...overrides } : item);
    assert.equal(projectWeaponFormDetails(entity, knowledge, changed), null);
  }
});
test('all frozen string mapping labels validate in draft, but numeric and colliding IDs are rejected', () => {
  const { entity, knowledge } = weaponFormsFixture();
  entity.recordState = 'draft';
  const rows = entity.facts.at(-1).value.mechanics;
  rows[0].logicalId = '321';
  assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  rows[1].logicalId = 321;
  assert.match(validateWeaponForms(entity, knowledge).join('\n'), /invalid\/repeated logical identity/);
});

test('explicit copied stats cannot publish and appearance projection keeps the base preview private to the base panel', async () => {
  const explicit = weaponFormsFixture();
  const set = explicit.entity.facts.at(-1).value;
  set.soulForged.baseStatFactIds = [...set.base.baseStatFactIds];
  assert.throws(() => projectWeaponFormDetails(explicit.entity, explicit.knowledge), evidenceRequired);

  const knowledge = await loadKnowledge();
  const entity = structuredClone(knowledge.entityById.get('weapon:heishang'));
  const original = entity.facts.find((fact) => fact.key === 'weapon.baseStat');
  const preview = { ...original, id: 'fixture-base-preview', key: 'weapon.previewStat',
    value: { ...original.value, displayedLevel: 30, displayContext: 'official-pre-release-ui' } };
  entity.facts.push(preview);
  const media = JSON.parse(await readFile(new URL('../data/media.json', import.meta.url))).records;
  const { forms } = projectWeaponFormDetails(entity, knowledge, media);
  assert(forms.base.detail.overview.baseStats.some((fact) => fact.id === original.id));
  assert.deepEqual(forms.base.detail.overview.previewStats.map((fact) => fact.id), [preview.id]);
  assert(forms.soulForged.detail.overview.baseStats.every((fact) => fact.value.displayedLevel === 30));
  assert.deepEqual(forms.soulForged.detail.overview.previewStats, []);
  assert.equal(forms.soulForged.pendingTechnicalDetails, false);
});
const invalid = [
  ['foreign Fact reference', ({ entity }) => { entity.facts.at(-1).value.base.nameFactId = 'fact:weapon:other:name'; }, /invalid own-entity weapon\.name reference/],
  ['missing Source', ({ knowledge }) => { knowledge.sourceById.clear(); }, /form-set: missing Source/],
  ['missing version', ({ knowledge }) => { knowledge.versionById.clear(); }, /form-set: missing GameVersion/],
  ['invalid Media ID', ({ entity }) => { entity.facts.at(-1).value.soulForged.mediaId = 'media:absent'; }, /invalid independent soulForged Media/],
  ['base image reused', ({ knowledge }) => { knowledge.mediaRecords[1].src = knowledge.mediaRecords[0].src; }, /forged appearance cannot reuse base image/],
  ['wrong Media form', ({ knowledge }) => { knowledge.mediaRecords[1].weaponForm = 'base'; }, /invalid independent soulForged Media/],
  ['draft Media', ({ knowledge }) => { knowledge.mediaRecords[1].recordState = 'draft'; }, /invalid independent soulForged Media/],
  ['foreign Media', ({ knowledge }) => { knowledge.mediaRecords[1].entityId = 'weapon:other'; }, /invalid independent soulForged Media/],
  ['unreviewed Media', ({ knowledge }) => { knowledge.mediaRecords[1].rightsStatus = 'review-required'; }, /invalid independent soulForged Media/],
  ['implicit name-matched shared skill', ({ entity }) => { const item = entity.facts.at(-1).value.mechanics[1]; item.change = 'shared'; }, /invalid explicit shared mapping/],
  ['implicit level-matched shared node', ({ entity }) => { entity.facts.at(-1).value.progressionNodes[1].change = 'shared'; }, /invalid explicit shared mapping/],
  ['repeated logical identity', ({ entity }) => { const rows = entity.facts.at(-1).value.mechanics; rows[1].logicalId = rows[0].logicalId; }, /invalid\/repeated logical identity/],
  ['same fact under different logical identities', ({ entity }) => { const rows = entity.facts.at(-1).value.mechanics; rows[1] = { ...rows[0], logicalId: 'another' }; }, /Fact mapped under multiple logical identities/],
  ['unmapped original skill', ({ entity }) => { entity.facts.at(-1).value.mechanics.pop(); }, /unmapped active weapon\.mechanic/],
  ['inferred new skill', ({ entity }) => { entity.facts.at(-1).value.mechanics[2].baseFactId = 'invalid'; }, /invalid explicit added mapping/],
  ['mixed displayed levels within form', ({ entity }) => { const value = entity.facts.at(-1).value; value.base.baseStatFactIds.push(...value.soulForged.baseStatFactIds); }, /mixed displayed levels or repeated stats within base/],
  ['effect with invented unlock level', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.soulForgeEffect').value.level = 25; }, /effect requires only name and description/],
  ['conflicting current effect', ({ entity }) => { entity.facts.push({ ...structuredClone(entity.facts.find((f) => f.key === 'weapon.soulForgeEffect')), id: 'fact:weapon:fixture-soul:second-effect' }); }, /weapon\.soulForgeEffect: conflicting effective version\/scope/],
  ['major skill downgraded', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').spoilerLevel = 'major'; }, /form set cannot downgrade major spoiler/],
  ['major Media downgraded', ({ knowledge }) => { knowledge.mediaRecords[1].spoilerLevel = 'major'; }, /form set cannot downgrade major Media/],
  ['pending technical Fact', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').status = 'pending-review'; }, /incompatible Fact status\/version\/scope/],
  ['incompatible platform', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').scope.platforms.ids = ['platform:playstation-5']; }, /incompatible Fact status\/version\/scope/],
  ['future Fact', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').validFromVersionId = 'version:fixture-v3'; }, /incompatible Fact status\/version\/scope/],
  ['ended Fact', ({ entity }) => { entity.facts.find((f) => f.key === 'weapon.mechanic').validToVersionId = 'version:fixture-v2'; }, /incompatible Fact status\/version\/scope/],
  ['Owner naming statement used for technical evidence', ({ knowledge }) => { knowledge.sourceById.get('source:fixture-screenshot').locator.type = 'user-supplied-statement'; }, /Owner statement may support a name, not technical game facts/],
];
for (const [label, mutate, diagnostic] of invalid) test(`rejects ${label}`, () => {
  const fixture = weaponFormsFixture();
  fixture.entity.recordState = 'draft';
  assert.deepEqual(validateWeaponForms(fixture.entity, fixture.knowledge), []);
  mutate(fixture);
  const errors = validateWeaponForms(fixture.entity, fixture.knowledge).join('\n');
  assert.doesNotMatch(errors, evidenceRequired, 'the general publication gate must not satisfy this assertion');
  assert.match(errors, diagnostic);
});
test('historical and disjoint-scope effects do not conflict, overlapping current versions do', () => {
  const fixture = weaponFormsFixture(), { entity, knowledge } = fixture;
  entity.recordState = 'draft';
  const effect = structuredClone(entity.facts.find((f) => f.key === 'weapon.soulForgeEffect'));
  effect.id += '-historical'; effect.gameVersionId = 'version:fixture-v1'; effect.validFromVersionId = 'version:fixture-v1'; effect.validToVersionId = 'version:fixture-v2';
  entity.facts.push(effect); assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  effect.validToVersionId = null; effect.scope.platforms.ids = ['platform:playstation-5']; assert.deepEqual(validateWeaponForms(entity, knowledge), []);
  effect.scope.platforms.ids = ['platform:pc']; assert(validateWeaponForms(entity, knowledge).some((e) => e.includes('conflicting')));
});
for (const [label, mutate] of [
  ['draft', (e) => { e.recordState = 'draft'; }],
  ['archived', (e) => { e.recordState = 'archived'; }],
  ['major entity', (e) => { e.spoilerLevel = 'major'; }],
  ['major name', (_, f) => { f.spoilerLevel = 'major'; }],
  ['pending-review', (_, f) => { f.status = 'pending-review'; }],
  ['editorial', (_, f) => { f.status = 'editorial'; }],
  ['ended', (_, f) => { f.validToVersionId = 'version:fixture-v2'; }],
  ['superseded', (_, f) => { f.supersededBy = 'fact:replacement'; }],
  ['future by version', (_, f) => { f.validFromVersionId = 'version:fixture-v3'; }],
  ['missing version', (_, f) => { f.gameVersionId = 'version:missing'; }],
  ['missing source', (_, f) => { f.sourceIds = ['source:missing']; }],
  ['unpublished source', (_, f, k) => { k.sourceById.get(f.sourceIds[0]).recordState = 'draft'; }]
]) test(`Search excludes ${label} forged names while preserving ordinary aliases`, () => {
  const { entity, knowledge } = weaponFormsFixture();
  const name = entity.facts.find((fact) => fact.key === 'weapon.soulForgedName');
  entity.id = 'weapon:heishang';
  entity.facts = [name];
  Object.assign(entity, {
    schemaVersion: '1.0-implementation', summary: 'Private fixture summary', summaryFactIds: [name.id],
    aliases: [
      { value: 'Base search name', kind: 'search-only', status: 'observation' },
      { value: name.value.toUpperCase(), kind: 'legacy-title', status: 'observation' }
    ]
  });
  const search = () => buildSearchDocuments([{ file: 'fixture.json', entity }], 'production', new Set([entity.slug]), knowledge).documents[0];
  assert.deepEqual(search().aliases, ['Base search name', name.value]);
  mutate(entity, name, knowledge);
  assert.deepEqual(searchableForgedNames(entity, knowledge), []);
  const document = search();
  if (entity.recordState === 'published' && entity.spoilerLevel !== 'major') {
    assert.deepEqual(document.aliases, ['Base search name']);
    assert.equal(document.displayName, entity.displayName);
  } else assert.equal(document, undefined);
});
test('declared forged names and pending aliases cannot enter four-weapon base aliases', async () => {
  const knowledge = await loadKnowledge();
  const entity = structuredClone(knowledge.entityById.get('weapon:heishang'));
  entity.aliases = [{ value: '黑魔伤', status: 'observation' }, { value: 'Under review', status: 'pending-review' }];
  assert.deepEqual(validateWeaponForms(entity, knowledge), [
    'weapon:heishang: base alias cannot publish a reserved soul-forged name or unreviewed alias',
    'weapon:heishang: base alias cannot publish a reserved soul-forged name or unreviewed alias'
  ]);
});

test('production data validator rejects injected cross-entity form references and non-name Owner statements', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pbz-soul-negative-'));
  try {
    await cp(new URL('../data/', import.meta.url), join(directory, 'data'), { recursive: true });
    const path = join(directory, 'data/weapons/heishang.json'), weapon = JSON.parse(await readFile(path, 'utf8'));
    const name = weapon.facts.find((fact) => fact.key === 'weapon.soulForgedName');
    Object.assign(name, { key: 'weapon.mechanic', valueType: 'object', value: { name: 'Fake skill', description: 'Not permitted' } });
    await writeFile(path, JSON.stringify(weapon));
    const result = spawnSync(process.execPath, ['scripts/validate-data.mjs', `--data-dir=${join(directory, 'data')}`], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Owner naming confirmation cannot verify technical Facts/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('PC screenshot claims reject altered facts, cross-weapon evidence and version or scope drift', async () => {
  const original = await loadKnowledge();
  for (const mutate of [
    ({ stat }) => { stat.value.displayedValue++; },
    ({ stat }) => { stat.scope.platforms.ids = ['platform:playstation-5']; },
    ({ stat }) => { stat.validFromVersionId = 'version:release-pc-ui-2026-10-29'; },
    ({ claim }) => { claim.locations[0].evidenceItemId = 'pc-101916'; },
    ({ claim }) => { claim.locations[0].position = ''; },
    ({ source }) => { source.recordState = 'draft'; },
    ({ source }) => { source.spoilerLevel = 'major'; },
    ({ version }) => { version.versionLabel = 'unverified-build'; }
  ]) {
    const knowledge = structuredClone(original);
    const entity = knowledge.entityById.get('weapon:heishang');
    const stat = entity.facts.find((fact) => fact.key === 'weapon.baseStat' && fact.gameVersionId === soulBatchVersion);
    const source = knowledge.sourceById.get(soulBatchSource);
    const claim = source.locator.weaponFormClaims.find(({ factId }) => factId === stat.id);
    mutate({ stat, claim, source, version: knowledge.versionById.get(soulBatchVersion) });
    assert.throws(() => projectWeaponFormDetails(entity, knowledge), /screenshot claim|screenshot batch|incompatible Fact/);
  }
});

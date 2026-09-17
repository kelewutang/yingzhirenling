import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildWeaponCollectionCard } from '../src/lib/collection-models.mjs';
import { projectWeaponDetail } from '../src/lib/projections.mjs';

const root = resolve(process.cwd());
const expectedTaxonomy = new Map([
  ['bashpole', ['影之武', '大锤']],
  ['jagged-steel', ['主武器', '剑']],
  ['night-owl', ['影之武', '弓']],
  ['seamless-death', ['主武器', '投掷类']],
  ['soft-snake-sword', ['主武器', '剑']],
  ['tang-hengdao', ['主武器', '刀类']],
  ['white-serpent-crimson-viper', ['主武器', '双剑']],
  ['white-shadow', ['主武器', '双手剑']],
  ['ya-hengdao', ['主武器', '刀类']]
]);

async function readWeapon(slug) {
  return JSON.parse(await readFile(resolve(root, 'data', 'weapons', `${slug}.json`), 'utf8'));
}

async function readAllWeapons() {
  const directory = resolve(root, 'data', 'weapons');
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort();
  return Promise.all(names.map(readWeapon));
}

function activeFact(weapon, key) {
  const facts = weapon.facts.filter((fact) => fact.key === key && fact.supersededBy === null);
  assert.equal(facts.length, 1, `${weapon.id}: ${key} must have exactly one active Fact`);
  return facts[0];
}

test('published Weapon taxonomy is normalized into systemCategory and weaponType', async () => {
  const allWeapons = await readAllWeapons();
  const publishedWeapons = allWeapons.filter((weapon) => weapon.recordState === 'published');
  const publishedSlugs = publishedWeapons.map((weapon) => weapon.slug).sort();
  const expectedSlugs = [...expectedTaxonomy.keys()].sort();
  assert.deepEqual(publishedSlugs, expectedSlugs, 'Published Weapon set must exactly match the frozen taxonomy table');
  assert(!publishedSlugs.includes('qinglong-lueyue-dao'), 'Draft Qinglong must stay outside the published taxonomy gate');

  const weaponsBySlug = new Map(publishedWeapons.map((weapon) => [weapon.slug, weapon]));

  for (const [slug, [systemCategory, weaponType]] of expectedTaxonomy) {
    const weapon = weaponsBySlug.get(slug);
    assert(weapon, `${slug}: frozen Weapon must be published`);
    const systemCategoryFact = activeFact(weapon, 'weapon.systemCategory');
    const weaponTypeFact = activeFact(weapon, 'weapon.weaponType');
    assert.equal(systemCategoryFact.value, systemCategory);
    assert.equal(weaponTypeFact.value, weaponType);
    assert.ok(systemCategoryFact.sourceIds.length > 0, `${weapon.id}: system category must remain sourced`);
    assert.ok(weaponTypeFact.sourceIds.length > 0, `${weapon.id}: weapon type must remain sourced`);

    const detail = projectWeaponDetail(weapon, { versionById: new Map() });
    assert.equal(detail.taxonomy?.valueText, `${systemCategory} · ${weaponType}`);
    assert.equal(detail.overview.taxonomy?.valueText, `${systemCategory} · ${weaponType}`);
    assert.equal(detail.overview.type, undefined, `${weapon.id}: legacy kind must not drive public detail taxonomy`);
    const card = buildWeaponCollectionCard(weapon);
    assert.equal(card.secondary, `${systemCategory} · ${weaponType}`);
    assert.equal(card.summary, null, `${weapon.id}: collection presentation must not expose the long summary`);
    assert.ok(weapon.summary.length > 0, `${weapon.id}: Knowledge summary must remain available outside the card presentation`);
  }
});

test('White Serpent historical alias remains searchable data but is absent from its public card model', async () => {
  const weapon = await readWeapon('white-serpent-crimson-viper');
  assert.ok(weapon.aliases.some((alias) => alias.value === 'White Serpent & Crimson Viper'));
  assert.ok(!buildWeaponCollectionCard(weapon).aliases.includes('White Serpent & Crimson Viper'));
});

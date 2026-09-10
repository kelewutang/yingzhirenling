import assert from 'node:assert/strict';
import test from 'node:test';
import { getFact } from '../src/lib/knowledge.mjs';
import { projectWeaponFacts } from '../src/lib/projections.mjs';

test('getFact returns the active replacement without removing historical Fact evidence', () => {
  const entity = {
    facts: [
      { id: 'fact:weapon:test:name-historical', key: 'weapon.name', value: 'Historical name', supersededBy: 'fact:weapon:test:name-current' },
      { id: 'fact:weapon:test:name-current', key: 'weapon.name', value: 'Current name', supersededBy: null }
    ]
  };

  assert.equal(getFact(entity, 'weapon.name')?.id, 'fact:weapon:test:name-current');
  assert.equal(entity.facts[0].value, 'Historical name');
});

test('weapon projection excludes superseded Facts and retains every active preview stat', () => {
  const weapon = {
    facts: [
      {
        id: 'fact:weapon:test:preview-old',
        key: 'weapon.previewStat',
        value: { statName: '旧属性', displayedValue: 1, displayedLevel: 30, displayContext: 'official-pre-release-ui' },
        status: 'observation',
        gameVersionId: 'version:test',
        supersededBy: 'fact:weapon:test:preview-damage'
      },
      {
        id: 'fact:weapon:test:preview-damage',
        key: 'weapon.previewStat',
        value: { statName: '伤害能力', displayedValue: 1217, displayedLevel: 30, displayContext: 'official-pre-release-ui' },
        status: 'observation',
        gameVersionId: 'version:test',
        supersededBy: null
      },
      {
        id: 'fact:weapon:test:preview-break',
        key: 'weapon.previewStat',
        value: { statName: '破防能力', displayedValue: 640, displayedLevel: 30, displayContext: 'official-pre-release-ui' },
        status: 'observation',
        gameVersionId: 'version:test',
        supersededBy: null
      }
    ]
  };

  const facts = projectWeaponFacts(weapon, { versionById: new Map() });
  assert.deepEqual(facts.map((fact) => fact.id), [
    'fact:weapon:test:preview-damage',
    'fact:weapon:test:preview-break'
  ]);
  assert.deepEqual(facts.map((fact) => fact.valueText), [
    'Lv30：伤害能力 1217',
    'Lv30：破防能力 640'
  ]);
  assert.ok(facts.every((fact) => fact.description === '官方预发布界面观察，数值可能随正式版平衡调整。'));
});

test('weapon projection retains every active mechanic and progression node', () => {
  const weapon = {
    facts: [
      { id: 'fact:weapon:test:mechanic-basic', key: 'weapon.mechanic', value: '普通连招', status: 'observation', gameVersionId: 'version:test', supersededBy: null },
      { id: 'fact:weapon:test:mechanic-killing-intent', key: 'weapon.mechanic', value: '杀气连招', status: 'observation', gameVersionId: 'version:test', supersededBy: null },
      { id: 'fact:weapon:test:node-crimson-viper-pursuit', key: 'weapon.progressionNode', value: '赤练追魂', status: 'observation', gameVersionId: 'version:test', supersededBy: null },
      { id: 'fact:weapon:test:node-phantom-crimson-viper', key: 'weapon.progressionNode', value: '幻化赤练', status: 'observation', gameVersionId: 'version:test', supersededBy: null }
    ]
  };

  const facts = projectWeaponFacts(weapon, { versionById: new Map() });
  assert.deepEqual(
    facts.filter((fact) => fact.key === 'weapon.mechanic').map((fact) => fact.value),
    ['普通连招', '杀气连招']
  );
  assert.deepEqual(
    facts.filter((fact) => fact.key === 'weapon.progressionNode').map((fact) => fact.value),
    ['赤练追魂', '幻化赤练']
  );
});

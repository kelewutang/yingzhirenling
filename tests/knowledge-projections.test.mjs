import assert from 'node:assert/strict';
import test from 'node:test';
import { getFact } from '../src/lib/knowledge.mjs';
import { projectWeaponDetail, projectWeaponFacts } from '../src/lib/projections.mjs';

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

test('weapon detail prefers current overview values and groups active guide content', () => {
  const weapon = {
    displayName: '白蟒赤练',
    facts: [
      { id: 'fact:weapon:test:name-historical', key: 'weapon.name', valueType: 'string', value: 'White Serpent & Crimson Viper', status: 'observation', gameVersionId: 'version:demo', checkedAt: '2026-08-30', supersededBy: null },
      { id: 'fact:weapon:test:name-current', key: 'weapon.name', valueType: 'string', value: '白蟒赤练', status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:kind-historical', key: 'weapon.kind', valueType: 'string', value: '主武器（双剑）', status: 'observation', gameVersionId: 'version:demo', checkedAt: '2026-08-30', supersededBy: null },
      { id: 'fact:weapon:test:kind-current', key: 'weapon.kind', valueType: 'string', value: '双持武器', status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:mechanic-string', key: 'weapon.mechanic', valueType: 'string', value: '普通连招', status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:mechanic-detail', key: 'weapon.mechanic', valueType: 'object', value: { name: '冰冻', input: '□ △', description: '累计至满时触发冰冻。', derivedInputs: [{ inputs: ['○'], label: '结束冰冻', labelKind: 'functional' }] }, status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:node-string', key: 'weapon.progressionNode', valueType: 'string', value: '赤练追魂', status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:node-detail', key: 'weapon.progressionNode', valueType: 'object', value: { name: '幻化赤练', level: 15, description: '截图中可确认的节点说明。', input: '○' }, status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:preview-damage', key: 'weapon.previewStat', valueType: 'object', value: { statName: '伤害能力', displayedValue: 1217, displayedLevel: 30, displayContext: 'official-pre-release-ui' }, status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null },
      { id: 'fact:weapon:test:preview-break', key: 'weapon.previewStat', valueType: 'object', value: { statName: '破防能力', displayedValue: 640, displayedLevel: 30, displayContext: 'official-pre-release-ui' }, status: 'observation', gameVersionId: 'version:current', checkedAt: '2026-09-10', supersededBy: null }
    ]
  };
  const knowledge = { versionById: new Map([['version:demo', { sequence: 20 }], ['version:current', { sequence: 25 }]]) };

  const detail = projectWeaponDetail(weapon, knowledge);
  assert.equal(detail.overview.displayName, '白蟒赤练');
  assert.equal(detail.overview.type?.valueText, '双持武器');
  assert.equal(detail.overview.type?.id, 'fact:weapon:test:kind-current');
  assert.equal(detail.sourceFacts.filter((fact) => fact.key === 'weapon.name').length, 2);
  assert.deepEqual(detail.mechanics.map((fact) => fact.valueText), ['普通连招', '冰冻']);
  assert.equal(detail.mechanics[0].description, null);
  assert.equal(detail.mechanics[1].description, '累计至满时触发冰冻。');
  assert.equal(detail.mechanics[1].input, '□ △');
  assert.deepEqual(detail.mechanics[1].derivedInputs, [{ inputs: ['○'], label: '结束冰冻', labelKind: 'functional' }]);
  assert.deepEqual(detail.mechanics[0].derivedInputs, []);
  assert.deepEqual(detail.progressionNodes.map((fact) => fact.valueText), ['赤练追魂', '幻化赤练']);
  assert.equal(detail.progressionNodes[1].description, '截图中可确认的节点说明。');
  assert.equal(detail.progressionNodes[1].level, 15);
  assert.equal(detail.progressionNodes[1].input, '○');
  assert.equal(detail.overview.previewStats.length, 2);
});

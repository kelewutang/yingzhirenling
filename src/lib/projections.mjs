import { getFact, statusLabel, versionLabel } from './knowledge.mjs';

const specs = [
  ['weapon.exists', '核心资料', '公开记录'],
  ['weapon.name', '核心资料', '名称记录'],
  ['weapon.kind', '核心资料', '武器类型'],
  ['weapon.publicAppearance', '核心资料', '公开出现方式'],
  ['weapon.observedTrait', '试玩与公开实机观察', '演示观察'],
  ['weapon.editorRating', '编辑评价', '发售前编辑预估'],
  ['weapon.acquisition', '获取方式', '获取方式']
];

function displayValue(fact) {
  if (fact.status === 'pending-review') {
    return fact.key === 'weapon.acquisition'
      ? '获取方式尚待后续官方资料或正式版验证。'
      : '详细动作与性能尚待更多可靠资料确认。';
  }
  if (fact.key === 'weapon.exists') return '已在可核查的发售前材料中出现。';
  if (fact.key === 'weapon.publicAppearance') return '已在公开试玩资料中出现';
  if (fact.key === 'weapon.editorRating') {
    return '★'.repeat(fact.value.score) + '☆'.repeat(fact.value.max - fact.value.score) + `（${fact.value.score}/${fact.value.max}）`;
  }
  return String(fact.value);
}

export function projectWeaponFacts(weapon, knowledge) {
  return specs.map(([key, section, title]) => {
    const fact = getFact(weapon, key);
    return fact && {
      ...fact,
      section,
      title,
      valueText: displayValue(fact),
      description: fact.status === 'editorial' ? '本站发售前编辑判断，不是官方评分或试玩客观数值。' : null,
      statusText: statusLabel(fact.status),
      versionText: versionLabel(fact.gameVersionId, knowledge)
    };
  }).filter(Boolean);
}

export function projectCharacterFacts(character, knowledge) {
  const characterSpecs = [
    ['character.exists', '公开记录'],
    ['character.name', '名称记录'],
    ['character.role', '身份定位']
  ];
  return characterSpecs.map(([key, title]) => {
    const fact = getFact(character, key);
    return fact && {
      ...fact,
      section: '核心资料',
      title,
      valueText: fact.key === 'character.exists' ? '已在可核查的发售前官方材料中出现。' : String(fact.value),
      description: null,
      statusText: statusLabel(fact.status),
      versionText: versionLabel(fact.gameVersionId, knowledge)
    };
  }).filter(Boolean);
}

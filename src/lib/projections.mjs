import { getFact, statusLabel, versionLabel } from './knowledge.mjs';

const specs = [
  ['weapon.exists', '核心资料', '公开记录'],
  ['weapon.name', '核心资料', '名称记录'],
  ['weapon.kind', '核心资料', '武器类型'],
  ['weapon.publicAppearance', '核心资料', '公开出现方式'],
  ['weapon.observedTrait', '试玩与公开实机观察', '演示观察'],
  ['weapon.mechanic', '战斗机制', '机制名称'],
  ['weapon.progressionNode', '武器成长', '成长节点'],
  ['weapon.previewStat', '预发布界面观察', 'Lv30 显示属性'],
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
  if (fact.key === 'weapon.previewStat') {
    return `Lv${fact.value.displayedLevel}：${fact.value.statName} ${fact.value.displayedValue}`;
  }
  if (['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key) &&
      fact.valueType === 'object') {
    return fact.value.name;
  }
  return String(fact.value);
}

function detailDescription(fact) {
  if (fact.key === 'weapon.previewStat') return '官方预发布界面观察，数值可能随正式版平衡调整。';
  if (['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key) &&
      fact.valueType === 'object') return fact.value.description || null;
  if (fact.status === 'editorial') return '本站发售前编辑判断，不是官方评分或试玩客观数值。';
  return null;
}

function projectWeaponFact(fact, section, title, knowledge) {
  return {
    ...fact,
    section,
    title,
    valueText: displayValue(fact),
    description: detailDescription(fact),
    statusText: statusLabel(fact.status),
    versionText: versionLabel(fact.gameVersionId, knowledge)
  };
}

export function projectWeaponFacts(weapon, knowledge) {
  return specs.flatMap(([key, section, title]) =>
    weapon.facts.filter((fact) => fact.key === key && fact.supersededBy === null)
      .map((fact) => projectWeaponFact(fact, section, title, knowledge))
  );
}

function activeWeaponFacts(weapon, key) {
  return weapon.facts.filter((fact) => fact.key === key && fact.supersededBy === null);
}

function preferredWeaponFact(facts, knowledge) {
  return [...facts].sort((left, right) => {
    const versionDelta = (knowledge.versionById.get(right.gameVersionId)?.sequence ?? -1) -
      (knowledge.versionById.get(left.gameVersionId)?.sequence ?? -1);
    if (versionDelta !== 0) return versionDelta;
    return right.checkedAt.localeCompare(left.checkedAt);
  })[0] || null;
}

export function projectWeaponDetail(weapon, knowledge) {
  const typeFact = preferredWeaponFact(activeWeaponFacts(weapon, 'weapon.kind'), knowledge);
  const previewStats = activeWeaponFacts(weapon, 'weapon.previewStat')
    .map((fact) => projectWeaponFact(fact, '武器概览', '预发布 Lv30 展示', knowledge));
  const overviewNotes = [
    ['weapon.observedTrait', '演示观察'],
    ['weapon.editorRating', '编辑评价'],
    ['weapon.acquisition', '获取方式']
  ].flatMap(([key, title]) => activeWeaponFacts(weapon, key)
    .map((fact) => projectWeaponFact(fact, '武器概览', title, knowledge)));

  return {
    eyebrow: typeFact ? `武器 · ${displayValue(typeFact)}` : '武器',
    overview: {
      displayName: weapon.displayName,
      type: typeFact ? projectWeaponFact(typeFact, '武器概览', '武器类型', knowledge) : null,
      notes: overviewNotes,
      previewStats
    },
    mechanics: activeWeaponFacts(weapon, 'weapon.mechanic')
      .map((fact) => projectWeaponFact(fact, '招式与机制', '招式与机制', knowledge)),
    progressionNodes: activeWeaponFacts(weapon, 'weapon.progressionNode')
      .map((fact) => projectWeaponFact(fact, '武器成长', '武器成长', knowledge)),
    sourceFacts: weapon.facts.filter((fact) => fact.supersededBy === null)
  };
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

export function projectBossFacts(boss, knowledge) {
  const bossSpecs = [
    ['boss.exists', '核心资料', '公开记录'],
    ['boss.name', '核心资料', '名称记录'],
    ['boss.kind', '核心资料', '敌人类型'],
    ['boss.publicAppearance', '公开资料', '公开出现方式']
  ];
  return bossSpecs.map(([key, section, title]) => {
    const fact = getFact(boss, key);
    return fact && {
      ...fact,
      section,
      title,
      valueText: fact.key === 'boss.exists' ? '已在可核查的发售前公开资料中作为 Boss 战出现。' : String(fact.value),
      description: null,
      statusText: statusLabel(fact.status),
      versionText: versionLabel(fact.gameVersionId, knowledge)
    };
  }).filter(Boolean);
}

export function projectLocationFacts(location, knowledge) {
  const locationSpecs = [
    ['location.exists', '核心资料', '公开记录'],
    ['location.name', '核心资料', '名称记录'],
    ['location.kind', '核心资料', '地点类型'],
    ['location.publicAppearance', '公开资料', '公开出现方式'],
    ['location.observedTrait', '公开场景观察', '场景特征']
  ];
  return locationSpecs.map(([key, section, title]) => {
    const fact = getFact(location, key);
    let valueText = fact ? String(fact.value) : '';
    if (fact?.key === 'location.exists') valueText = '已在可核查的发售前官方资料中作为地点出现。';
    if (fact?.key === 'location.publicAppearance') valueText = '已在官方场景展示中公开';
    return fact && {
      ...fact,
      section,
      title,
      valueText,
      description: null,
      statusText: statusLabel(fact.status),
      versionText: versionLabel(fact.gameVersionId, knowledge)
    };
  }).filter(Boolean);
}

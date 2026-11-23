import { getFact, loadKnowledge, statusLabel, versionLabel } from './knowledge.mjs';
import { getProductionHeroMedia } from './media.mjs';
import { assertPublishableWeaponForms, isForgedBatchFact, isSoulFormWeapon, isSoulResourceConfirmation, resolveAppearanceForms } from './weapon-forms.mjs';
import { isMajorSpoiler } from './spoilers.mjs';
import { pcDetailsVersionId } from './weapon-pc-details.mjs';

const specs = [
  ['weapon.exists', '核心资料', '公开记录'],
  ['weapon.name', '核心资料', '名称记录'],
  ['weapon.systemCategory', '核心资料', '武器定位'],
  ['weapon.weaponType', '核心资料', '武器类型'],
  ['weapon.grip', '核心资料', '持握方式'],
  ['weapon.description', '核心资料', '武器介绍'],
  ['weapon.baseStat', '基础属性', '正式版显示属性'],
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
  if (['weapon.previewStat', 'weapon.baseStat'].includes(fact.key)) {
    return `Lv${fact.value.displayedLevel}：${fact.value.statName} ${fact.value.displayedValue}`;
  }
  if (['weapon.mechanic', 'weapon.progressionNode', 'weapon.soulForgeEffect'].includes(fact.key) &&
      fact.valueType === 'object') {
    return fact.value.name;
  }
  return String(fact.value);
}

function detailDescription(fact) {
  if (fact.key === 'weapon.previewStat') return '官方预发布界面观察，数值可能随正式版平衡调整。';
  if (fact.key === 'weapon.baseStat') return 'PC正式版界面显示值，具体版本号未知。';
  if (['weapon.mechanic', 'weapon.progressionNode', 'weapon.soulForgeEffect'].includes(fact.key) &&
      fact.valueType === 'object') return fact.value.description || null;
  if (fact.status === 'editorial') return '本站发售前编辑判断，不是官方评分或试玩客观数值。';
  return null;
}

function detailInput(fact) {
  return ['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key) && fact.valueType === 'object'
    ? fact.value.input || null
    : null;
}

function detailDerivedInputs(fact) {
  return ['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key) && fact.valueType === 'object'
    ? fact.value.derivedInputs || []
    : [];
}

function progressionLevel(fact) {
  return fact.key === 'weapon.progressionNode' && fact.valueType === 'object'
    ? fact.value.level || null
    : null;
}

function projectWeaponFact(fact, section, title, knowledge) {
  return {
    ...fact,
    section,
    title,
    valueText: displayValue(fact),
    description: detailDescription(fact),
    input: detailInput(fact),
    derivedInputs: detailDerivedInputs(fact),
    level: progressionLevel(fact),
    statusText: statusLabel(fact.status),
    versionText: versionLabel(fact.gameVersionId, knowledge),
    platformText: scopeText(fact.scope?.platforms, knowledge.platformById),
    difficultyText: scopeText(fact.scope?.difficulties, knowledge.difficultyById)
  };
}

function scopeText(scope, labels) {
  if (scope?.mode !== 'include') return null;
  const names = scope.ids.map((id) => labels?.get(id)?.displayName || id);
  return names.join('、') || null;
}

export function projectWeaponFacts(weapon, knowledge) {
  return specs.flatMap(([key, section, title]) =>
    weapon.facts.filter((fact) => !isForgedBatchFact(fact) && fact.key === key && fact.supersededBy === null && fact.validToVersionId == null)
      .map((fact) => projectWeaponFact(fact, section, title, knowledge))
  );
}

function activeWeaponFacts(weapon, key) {
  return weapon.facts.filter((fact) => fact.key === key && fact.supersededBy === null && fact.validToVersionId == null);
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
  assertPublishableWeaponForms(weapon, knowledge);
  return projectWeaponDetailFacts({ ...weapon, facts: weapon.facts.filter((fact) => !isForgedBatchFact(fact)) }, knowledge);
}

function projectWeaponDetailFacts(weapon, knowledge) {
  const needsFormReview = isSoulFormWeapon(weapon);
  const detailFacts = (key) => activeWeaponFacts(weapon, key)
    .filter((fact) => !needsFormReview || isReviewedWeaponFact(fact, knowledge));
  const systemCategoryFact = preferredWeaponFact(detailFacts('weapon.systemCategory'), knowledge);
  const weaponTypeFact = preferredWeaponFact(detailFacts('weapon.weaponType'), knowledge);
  const gripFact = preferredWeaponFact(detailFacts('weapon.grip'), knowledge);
  const taxonomy = systemCategoryFact ? {
    systemCategory: projectWeaponFact(systemCategoryFact, '武器概览', '武器定位', knowledge),
    weaponType: weaponTypeFact ? projectWeaponFact(weaponTypeFact, '武器概览', '武器类型', knowledge) : null,
    grip: gripFact ? projectWeaponFact(gripFact, '武器概览', '持握方式', knowledge) : null,
    valueText: [systemCategoryFact, weaponTypeFact].filter(Boolean).map(displayValue).join(' · ')
  } : null;
  const baseStats = detailFacts('weapon.baseStat')
    .map((fact) => projectWeaponFact(fact, '基础属性', '正式版显示属性', knowledge));
  const previewStats = detailFacts('weapon.previewStat')
    .map((fact) => projectWeaponFact(fact, '武器概览', '预发布 Lv30 展示', knowledge));
  const overviewNotes = [
    ['weapon.description', '武器介绍'],
    ['weapon.observedTrait', '演示观察'],
    ['weapon.editorRating', '编辑评价'],
    ['weapon.acquisition', '获取方式']
  ].flatMap(([key, title]) => detailFacts(key)
    .filter((fact) => fact.status !== 'editorial' || key === 'weapon.editorRating')
    .map((fact) => projectWeaponFact(fact, '武器概览', title, knowledge)));

  return {
    eyebrow: '武器',
    taxonomy,
    overview: {
      displayName: weapon.displayName,
      taxonomy,
      notes: overviewNotes,
      previewStats,
      baseStats
    },
    mechanics: detailFacts('weapon.mechanic')
      .map((fact) => projectWeaponFact(fact, '招式与机制', '招式与机制', knowledge)),
    progressionNodes: detailFacts('weapon.progressionNode')
      .map((fact) => projectWeaponFact(fact, '武器成长', '武器成长', knowledge)),
    soulForgeEffects: detailFacts('weapon.soulForgeEffect')
      .map((fact) => projectWeaponFact(fact, '铸魂效果', '铸魂效果', knowledge)),
    sourceFacts: weapon.facts.filter((fact) => fact.key !== 'weapon.acquisitionOrder' && fact.supersededBy === null && fact.validToVersionId == null)
  };
}

const weaponSummaryFallback = '武器介绍待补充';
const reviewedFactStatuses = new Set(['official', 'observation', 'third-party', 'release-verified']);
const pcReleaseSnapshot = 'version:release-pc-ui-2026-10-29';

function isReviewedWeaponFact(fact, knowledge) {
  if (!fact || !reviewedFactStatuses.has(fact.status) || fact.supersededBy !== null ||
    fact.validToVersionId != null || !fact.sourceIds?.length) return false;
  const version = knowledge?.versionById?.get(fact.gameVersionId);
  const start = knowledge?.versionById?.get(fact.validFromVersionId ?? fact.gameVersionId);
  return Number.isInteger(version?.sequence) && Number.isInteger(start?.sequence) && start.sequence <= version.sequence &&
    fact.sourceIds.every((id) => {
      const source = knowledge.sourceById?.get(id);
      return source && !isMajorSpoiler(source) && !['draft', 'archived'].includes(source.recordState) &&
        (source.locator?.type !== 'user-supplied-statement' || isSoulResourceConfirmation(fact, source));
    });
}

function summaryFromDescription(weapon, description, knowledge) {
  const support = new Set(weapon.summaryFactIds ?? []);
  if (!description || isMajorSpoiler(description) || !support.has(description.id)) return weaponSummaryFallback;
  if (![pcReleaseSnapshot, pcDetailsVersionId].includes(description.gameVersionId)) return description.value;
  const category = getFact(weapon, 'weapon.systemCategory');
  const grip = category?.value === '主武器' ? getFact(weapon, 'weapon.grip') : null;
  const basis = category?.value === '影之武装' ? [category] : [category, grip];
  const appliesToPc = ({ scope }) => scope?.platforms?.mode === 'all' || scope?.platforms?.ids?.includes('platform:pc');
  const pcSource = description.sourceIds.find((id) => {
    const locator = knowledge.sourceById.get(id)?.locator;
    return locator?.type === 'user-supplied-game-screenshot' && locator.platformId === 'platform:pc' &&
      appliesToPc(description) && basis.every((fact) => isReviewedWeaponFact(fact, knowledge) && !isMajorSpoiler(fact) &&
        appliesToPc(fact) && fact.gameVersionId === description.gameVersionId && support.has(fact.id) && fact.sourceIds.includes(id));
  });
  if (!pcSource) return weaponSummaryFallback;
  return `PC正式版界面确认的${grip?.value ?? ''}${category.value}；${description.value}`;
}

export function projectWeaponPublicContent(weapon, knowledge) {
  const fact = getFact(weapon, 'weapon.description');
  const reviewed = isReviewedWeaponFact(fact, knowledge) && typeof fact.value === 'string' && fact.value.trim() ? fact : null;
  const description = reviewed ? { id: reviewed.id, value: reviewed.value, spoilerLevel: reviewed.spoilerLevel } : null;
  if (weapon.entityType !== 'weapon' || weapon.recordState !== 'published' || isMajorSpoiler(weapon)) {
    return { description: null, summary: weaponSummaryFallback };
  }
  const summary = summaryFromDescription(weapon, reviewed, knowledge);
  return { description, summary };
}

export function projectWeaponFormDetails(weapon, knowledge, mediaRecords = knowledge.mediaRecords || []) {
  assertPublishableWeaponForms(weapon, knowledge, knowledge.mediaRecords ?? mediaRecords);
  const set = resolveAppearanceForms(weapon, knowledge, mediaRecords);
  if (!set) return null;
  return { ...set, spoilerLevel: weapon.spoilerLevel === 'major' ? 'major' : set.spoilerLevel, forms: Object.fromEntries(Object.entries(set.forms).map(([key, form]) => [key,
    {
      ...form,
      pendingTechnicalDetails: key === 'soulForged' && form.entity.facts.length === 0,
      description: key === 'base' ? projectWeaponPublicContent(form.entity, knowledge).description
        : form.entity.facts.find((fact) => fact.key === 'weapon.description') ?? null,
      detail: projectWeaponDetailFacts(form.entity, knowledge)
    }
  ])) };
}

/** Resolve renderer inputs from the published entity identity and its registered Media. */
export async function loadPublishedWeaponForms(weaponId) {
  const knowledge = await loadKnowledge();
  const weapon = knowledge.entityById.get(weaponId);
  if (!isSoulFormWeapon(weapon) || weapon.recordState !== 'published') return null;
  const [base, soulForged] = await Promise.all([
    getProductionHeroMedia(weapon.id, weapon),
    getProductionHeroMedia(weapon.id, weapon, 'soulForged')
  ]);
  const formSet = projectWeaponFormDetails(weapon, knowledge, [base, soulForged].filter(Boolean));
  if (!formSet) return null;
  formSet.forms.base.media = base;
  formSet.forms.soulForged.media = soulForged;
  return formSet;
}

const namedEntityDetailKeys = new Set(['boss.mechanic', 'boss.strategy', 'location.route', 'location.bell', 'location.hiddenArea', 'location.quest', 'character.encounter', 'character.quest']);

function projectEntityFacts(entity, knowledge, specs, existsText) {
  return specs.flatMap(([key, section, title]) => {
    const candidates = namedEntityDetailKeys.has(key)
      ? entity.facts.filter((fact) => fact.key === key && fact.supersededBy === null && fact.validToVersionId == null && fact.status !== 'pending-review')
      : [getFact(entity, key, knowledge)].filter(Boolean);
    return candidates.map((fact) => {
      const release = knowledge.versionById.get(fact.gameVersionId)?.track === 'release';
      let valueText = namedEntityDetailKeys.has(key) ? fact.value.description : String(fact.value);
      if (key.endsWith('.exists')) valueText = release ? '已在可核查的发售后资料中收录。' : existsText;
      if (key === 'location.publicAppearance') valueText = '已在官方场景展示中公开';
      return {
        ...fact, section, title: namedEntityDetailKeys.has(key) ? fact.value.name : title, valueText,
        description: null,
        statusText: statusLabel(fact.status), versionText: versionLabel(fact.gameVersionId, knowledge),
        platformText: scopeText(fact.scope?.platforms, knowledge.platformById),
        difficultyText: scopeText(fact.scope?.difficulties, knowledge.difficultyById)
      };
    });
  });
}

export function projectCharacterFacts(character, knowledge) {
  return projectEntityFacts(character, knowledge, [
    ['character.exists', '核心资料', '公开记录'],
    ['character.name', '核心资料', '名称记录'],
    ['character.role', '核心资料', '身份定位'],
    ['character.affiliation', '核心资料', '所属势力'],
    ['character.encounter', '相遇与流程', '相遇记录'],
    ['character.quest', '相关任务', '任务提醒']
  ], '已在可核查的发售前官方材料中出现。');
}

export function projectBossFacts(boss, knowledge) {
  return projectEntityFacts(boss, knowledge, [
    ['boss.exists', '核心资料', '公开记录'],
    ['boss.name', '核心资料', '名称记录'],
    ['boss.kind', '核心资料', '敌人类型'],
    ['boss.publicAppearance', '公开资料', '公开出现方式'],
    ['boss.location', '出现位置', '区域与地标'],
    ['boss.mechanic', '攻击与机制', '攻击机制'],
    ['boss.strategy', '应对要点', '打法建议'],
    ['boss.reward', '战后奖励', '已记录奖励']
  ], '已在可核查的发售前公开资料中作为 Boss 战出现。');
}

export function projectLocationFacts(location, knowledge) {
  return projectEntityFacts(location, knowledge, [
    ['location.exists', '核心资料', '公开记录'],
    ['location.name', '核心资料', '名称记录'],
    ['location.kind', '核心资料', '地点类型'],
    ['location.publicAppearance', '公开资料', '公开出现方式'],
    ['location.observedTrait', '公开场景观察', '场景特征'],
    ['location.connection', '区域关系', '相邻入口'],
    ['location.route', '探索路线', '路线提示'],
    ['location.bell', '铃铛定位', '铃铛记录'],
    ['location.hiddenArea', '隐藏区域与回访', '回访条件'],
    ['location.quest', '相关任务', '任务提醒']
  ], '已在可核查的发售前官方资料中作为地点出现。');
}

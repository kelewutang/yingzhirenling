export const GUIDE_TYPES = Object.freeze(['walkthrough', 'boss', 'weapon', 'system', 'performance']);
export const GUIDE_TYPE_LABELS = Object.freeze({
  walkthrough: '流程攻略',
  boss: 'Boss 攻略',
  weapon: '武器攻略',
  system: '系统攻略',
  performance: '性能与设置'
});

const GUIDE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ENTITY_TYPES = new Set(['weapon', 'character', 'boss', 'location']);
const SPOILER_LEVELS = new Set(['none', 'minor', 'major']);

function values(value) {
  return Array.isArray(value) ? value : [];
}

function duplicate(valuesToCheck) {
  return new Set(valuesToCheck).size !== valuesToCheck.length;
}

function guideData(guide) {
  return guide.data || guide;
}

function label(guide) {
  return `Guide ${guide.id}`;
}

export function guideRoute(guide) {
  return `/guide/${guide.id}`;
}

export function hasMarkdownH1(body = '') {
  return /^ {0,3}#(?!#)\s+\S/m.test(body);
}

export function hasValidSpoilerBlocks(body = '') {
  const blocks = body.match(/<details\b[^>]*data-spoiler-level=["']major["'][^>]*>[\s\S]*?<\/details>/g) || [];
  const markers = body.match(/<details\b[^>]*data-spoiler-level=["']major["'][^>]*>/g) || [];
  const unsupported = body.match(/<details\b[^>]*data-spoiler-level=["'](?!major["'])[^"']+["'][^>]*>/g) || [];
  return unsupported.length === 0 && blocks.length === markers.length && blocks.every((block) =>
    /<summary>\s*[^<\n][\s\S]*?<\/summary>/.test(block) && /data-nosnippet(?:\s|>)/.test(block)
  );
}

export function validateGuides(guides, knowledge) {
  const errors = [];
  const seenIds = new Set();

  for (const guide of guides) {
    const data = guideData(guide);
    const prefix = label(guide);
    if (!GUIDE_ID_PATTERN.test(guide.id || '')) errors.push(`${prefix}: content ID 必须是 ASCII kebab-case`);
    if (seenIds.has(guide.id)) errors.push(`${prefix}: content ID 重复`);
    seenIds.add(guide.id);
    if (!GUIDE_TYPES.includes(data.guideType)) errors.push(`${prefix}: guideType 不受支持`);
    if (hasMarkdownH1(guide.body)) errors.push(`${prefix}: Markdown body 不得包含 H1；页面模板负责唯一 H1`);
    if (!SPOILER_LEVELS.has(data.spoilerLevel)) errors.push(`${prefix}: spoilerLevel 必须显式为 none、minor 或 major`);
    if (data.spoilerLevel === 'major' && (!data.safeTitle || !data.safeDescription)) {
      errors.push(`${prefix}: major Guide 必须提供 safeTitle 和 safeDescription`);
    }
    if (!hasValidSpoilerBlocks(guide.body)) errors.push(`${prefix}: major spoiler block 必须使用含 data-nosnippet 的原生 details/summary`);

    const sourceIds = values(data.sourceIds);
    const factIds = values(data.factIds);
    const entityIds = values(data.relatedEntityIds);
    const platformIds = values(data.platformIds);
    const difficultyIds = values(data.difficultyIds);
    const keywords = values(data.keywords);
    for (const [field, ids] of [['sourceIds', sourceIds], ['factIds', factIds], ['relatedEntityIds', entityIds], ['platformIds', platformIds], ['difficultyIds', difficultyIds], ['keywords', keywords]]) {
      if (duplicate(ids)) errors.push(`${prefix}: ${field} 不得重复`);
    }

    if (data.status === 'published') {
      if (!data.publishedAt || !data.updatedAt) errors.push(`${prefix}: published Guide 必须提供 publishedAt 和 updatedAt`);
      if (sourceIds.length === 0) errors.push(`${prefix}: published Guide 至少需要一个 sourceId`);
      if (data.publishedAt && data.updatedAt && data.publishedAt > data.updatedAt) errors.push(`${prefix}: publishedAt 不得晚于 updatedAt`);
    } else if (data.status === 'draft') {
      if (data.publishedAt !== null || data.updatedAt !== null) errors.push(`${prefix}: draft Guide 的 publishedAt 和 updatedAt 必须为 null`);
    } else {
      errors.push(`${prefix}: status 必须为 draft 或 published`);
    }

    for (const sourceId of sourceIds) if (!knowledge.sourceById.has(sourceId)) errors.push(`${prefix}: Source 不存在：${sourceId}`);
    if (data.gameVersionId && !knowledge.versionById.has(data.gameVersionId)) errors.push(`${prefix}: GameVersion 不存在：${data.gameVersionId}`);
    for (const factId of factIds) {
      const fact = knowledge.factById.get(factId);
      if (!fact) errors.push(`${prefix}: Fact 不存在：${factId}`);
      else if (data.status === 'published' && fact.supersededBy !== null) errors.push(`${prefix}: published Guide 不得引用已 superseded Fact：${factId}`);
    }
    for (const entityId of entityIds) {
      const entity = knowledge.entityById.get(entityId);
      if (!entity) {
        errors.push(`${prefix}: Entity 不存在：${entityId}`);
      } else if (!PUBLIC_ENTITY_TYPES.has(entity.entityType)) {
        errors.push(`${prefix}: relatedEntityIds 只允许 public Entity：${entityId}`);
      } else if (data.status === 'published' && entity.recordState !== 'published') {
        errors.push(`${prefix}: published Guide 只能关联 published Entity：${entityId}`);
      }
    }
    for (const platformId of platformIds) if (!knowledge.platformById.has(platformId)) errors.push(`${prefix}: Platform 不存在：${platformId}`);
    for (const difficultyId of difficultyIds) if (!knowledge.difficultyById.has(difficultyId)) errors.push(`${prefix}: Difficulty 不存在：${difficultyId}`);
  }

  if (errors.length > 0) throw new Error(`Guide validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

export function getPublishedGuides(guides) {
  return guides.filter((guide) => guideData(guide).status === 'published').sort((left, right) => {
    const dateDelta = (guideData(right).updatedAt || '').localeCompare(guideData(left).updatedAt || '');
    return dateDelta || left.id.localeCompare(right.id);
  });
}

export function getRelatedPublishedGuides(entityId, guides) {
  return getPublishedGuides(guides).filter((guide) => values(guideData(guide).relatedEntityIds).includes(entityId));
}

export function guideTypeLabel(guideType) {
  return GUIDE_TYPE_LABELS[guideType] || guideType;
}

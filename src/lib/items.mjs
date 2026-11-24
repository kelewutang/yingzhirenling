import { getFact } from './knowledge.mjs';

export const itemCollections = {
  accessory: { directory: 'accessories', label: '饰品', categories: ['生存类饰品', '攻击类饰品', '辅助类饰品'] },
  flask: { directory: 'flasks', label: '药瓶', categories: ['回复药', '秘药'] }
};

export function publishedItems(knowledge, type) {
  const spec = itemCollections[type];
  if (!spec) throw new Error(`Unsupported item type: ${type}`);
  return knowledge[spec.directory].filter((entity) => entity.recordState === 'published')
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function itemFact(entity, key, knowledge = null) {
  return getFact(entity, `${entity.entityType}.${key}`, knowledge);
}

export function itemCard(entity) {
  const type = entity.entityType;
  const spec = itemCollections[type];
  const level = itemFact(entity, 'level').value;
  const name = type === 'accessory' ? `${entity.displayName} ${level}` : entity.displayName;
  return { entity, href: `/${spec.directory}/${entity.slug}`, typeLabel: spec.label,
    displayName: name, aliases: [], summary: type === 'accessory' && entity.slug === 'kaiguang-yupei' ? '喝药时随机获得五种效果之一，包含对自身的影响。查看完整效果。' : entity.summary,
    secondary: itemFact(entity, 'kind').value,
    context: type === 'flask' ? `等级 ${level} · 可使用 ${itemFact(entity, 'uses').value} 次` : `当前强化 ${level}`,
    concealed: entity.spoilerLevel === 'major' };
}

export function itemDetail(entity) {
  const type = entity.entityType;
  const project = (key, title, section = '物品资料') => ({ ...itemFact(entity, key), title, section, valueText: itemFact(entity, key).value });
  const quick = [project('kind', '游戏内分类'), project('level', type === 'accessory' ? '截图强化等级' : '截图药瓶等级')];
  if (type === 'flask') quick.push(project('uses', '可使用次数'));
  return { quick, detail: [project('effect', '效果原文', type === 'accessory' ? '当前强化效果' : '恢复、增益与副作用'), project('description', '游戏内介绍', '物品介绍')] };
}

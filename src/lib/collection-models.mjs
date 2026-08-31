import { aliasValues, getFact } from './knowledge.mjs';

const typeLabels = { weapon: '武器', character: '角色', boss: 'Boss', location: '地点' };
const appearanceLabels = { demo: '公开试玩记录', 'gameplay-video': '公开实机记录', 'official-showcase': '官方场景展示' };

function factValue(entity, key) {
  const fact = getFact(entity, key);
  return fact ? String(fact.value) : null;
}

function compactAppearance(entity, key) {
  const value = factValue(entity, key);
  return value ? appearanceLabels[value] || '公开资料记录' : null;
}

function baseCard(entity, href, secondary, context) {
  return { entity, href, typeLabel: typeLabels[entity.entityType], displayName: entity.displayName, aliases: aliasValues(entity), summary: entity.summary, secondary, context };
}

export function buildWeaponCollectionCard(entity) {
  return baseCard(entity, `/weapons/${entity.slug}`, factValue(entity, 'weapon.kind'), compactAppearance(entity, 'weapon.publicAppearance'));
}

export function buildCharacterCollectionCard(entity) {
  return baseCard(entity, `/characters/${entity.slug}`, factValue(entity, 'character.role') || '公开材料提及', '当前已发布角色资料');
}

export function buildBossCollectionCard(entity) {
  return baseCard(entity, `/bosses/${entity.slug}`, factValue(entity, 'boss.kind') || 'Boss 身份', compactAppearance(entity, 'boss.publicAppearance'));
}

export function buildLocationCollectionCard(entity) {
  return baseCard(entity, `/world/${entity.slug}`, factValue(entity, 'location.kind'), factValue(entity, 'location.observedTrait') || compactAppearance(entity, 'location.publicAppearance'));
}

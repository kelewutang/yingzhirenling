import { getProductionRelationsForEntity, getPublishedBosses } from './knowledge.mjs';
import { relationIsConcealed } from './spoilers.mjs';

const routes = { boss: '/bosses/', location: '/world/', weapon: '/weapons/' };
function edges(id, type, knowledge, versionId) {
  return getProductionRelationsForEntity(id, knowledge, versionId).filter((r) => r.relationType === type);
}
function item(relation, entityId, knowledge) {
  const entity = knowledge.entityById.get(entityId);
  if (!entity || !routes[entity.entityType]) throw new Error(`Invalid gameplay relation target: ${entityId}`);
  const basis = relation.basisFactIds.map((id) => knowledge.factById.get(id));
  return {
    relation, entity, href: routes[entity.entityType] + entity.slug,
    description: relation.relationType === 'appearsIn' ? basis.map((f) => f.value).join(' ') : null,
    concealed: relationIsConcealed(relation, knowledge), children: []
  };
}
function withChildren(entry, children) {
  return { ...entry, children, concealed: entry.concealed || children.some((child) => child.concealed) };
}
export function getBossConnections(bossId, knowledge, versionId = null) {
  return {
    locations: edges(bossId, 'appearsIn', knowledge, versionId).map((r) => item(r, r.targetEntityId, knowledge)),
    weapons: edges(bossId, 'awardsWeapon', knowledge, versionId).map((r) => item(r, r.targetEntityId, knowledge))
  };
}
export function getLocationBosses(locationId, knowledge, versionId = null) {
  const order = new Map(getPublishedBosses(knowledge).map((e, i) => [e.id, i]));
  return edges(locationId, 'appearsIn', knowledge, versionId).map((r) => withChildren(
    item(r, r.sourceEntityId, knowledge), getBossConnections(r.sourceEntityId, knowledge, versionId).weapons
  )).sort((a, b) => order.get(a.entity.id) - order.get(b.entity.id) || a.relation.id.localeCompare(b.relation.id));
}
export function getWeaponAcquisition(weaponId, knowledge, versionId = null) {
  return edges(weaponId, 'awardsWeapon', knowledge, versionId).map((r) => withChildren(
    item(r, r.sourceEntityId, knowledge), getBossConnections(r.sourceEntityId, knowledge, versionId).locations
  ));
}
export function projectGameplayRelations(entity, knowledge) {
  let groups;
  if (entity.entityType === 'location') groups = [{ key: 'bosses', title: '本区域 Boss', entries: getLocationBosses(entity.id, knowledge) }];
  else if (entity.entityType === 'boss') {
    const connections = getBossConnections(entity.id, knowledge);
    groups = [{ key: 'locations', title: '所在区域', entries: connections.locations }, { key: 'weapons', title: '击败奖励', entries: connections.weapons }];
  } else if (entity.entityType === 'weapon') groups = [{ key: 'acquisition', title: '获取方式', entries: getWeaponAcquisition(entity.id, knowledge) }];
  else groups = [];
  return groups.filter((group) => group.entries.length);
}

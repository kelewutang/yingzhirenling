const labels = {
  parentOf: { forward: () => '子女', reverse: (name) => `${name}的父亲` },
  formerCompanionOf: { forward: () => '曾经的同伴', reverse: (name) => `${name}曾经的同伴` }
};

export function projectRelationsForEntity(entityId, relations, knowledge) {
  const currentEntity = knowledge.entityById.get(entityId);
  if (!currentEntity) throw new Error(`Relation projection Entity not found: ${entityId}`);
  return relations.map((relation) => {
    const forward = relation.sourceEntityId === entityId;
    const presentation = labels[relation.relationType];
    if (!presentation) throw new Error(`Unsupported relation presentation type: ${relation.relationType}`);
    const otherEntityId = forward ? relation.targetEntityId : relation.sourceEntityId;
    const otherEntity = knowledge.entityById.get(otherEntityId);
    if (!otherEntity) throw new Error(`${relation.id}: Relation endpoint not found: ${otherEntityId}`);
    return {
      ...relation,
      otherEntity,
      label: (forward ? presentation.forward : presentation.reverse)(currentEntity.displayName),
      versionText: knowledge.versionById.get(relation.gameVersionId)?.displayName || '当前公开资料阶段'
    };
  });
}

export const gameplayRelationEndpoints = Object.freeze({
  appearsIn: ['boss', 'location'],
  awardsWeapon: ['boss', 'weapon']
});

export function relationIsActive(relation, knowledge, versionId = null) {
  if (relation.status === 'pending-review') return false;
  if (!versionId) {
    const latest = Math.max(...[...knowledge.versionById.values()].map((v) => v.sequence));
    const from = relation.validFromVersionId ? knowledge.versionById.get(relation.validFromVersionId)?.sequence : -Infinity;
    return relation.validToVersionId === null && from <= latest;
  }
  const sequence = knowledge.versionById.get(versionId)?.sequence;
  if (sequence == null) throw new Error(`Unknown relation version: ${versionId}`);
  const from = relation.validFromVersionId ? knowledge.versionById.get(relation.validFromVersionId)?.sequence : -Infinity;
  const to = relation.validToVersionId ? knowledge.versionById.get(relation.validToVersionId)?.sequence : Infinity;
  return from <= sequence && sequence < to;
}

export function relationWindowsOverlap(left, right, versionById) {
  const from = (r) => r.validFromVersionId ? versionById.get(r.validFromVersionId)?.sequence ?? -Infinity : -Infinity;
  const to = (r) => r.validToVersionId ? versionById.get(r.validToVersionId)?.sequence ?? Infinity : Infinity;
  const scopeOverlap = ['platforms', 'difficulties'].every((key) => {
    const a = left.scope?.[key], b = right.scope?.[key];
    return !a || !b || a.mode === 'all' || b.mode === 'all' || a.ids.some((id) => b.ids.includes(id));
  });
  return scopeOverlap && Math.max(from(left), from(right)) < Math.min(to(left), to(right));
}

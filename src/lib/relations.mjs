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

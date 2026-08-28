const relationLabels = {
  parentOf: {
    forward: '子女',
    reverse: '父亲'
  },
  formerCompanionOf: {
    forward: '昔日同伴',
    reverse: '昔日同伴'
  }
};

export function projectRelationsForEntity(entityId, relations, knowledge) {
  return relations.map((relation) => {
    const isForward = relation.sourceEntityId === entityId;
    const otherEntityId = isForward ? relation.targetEntityId : relation.sourceEntityId;
    const labels = relationLabels[relation.relationType];
    if (!labels) throw new Error(`Unsupported relation presentation type: ${relation.relationType}`);
    return {
      ...relation,
      otherEntity: knowledge.entityById.get(otherEntityId),
      label: isForward ? labels.forward : labels.reverse,
      direction: isForward ? 'forward' : 'reverse'
    };
  });
}

export const SPOILER_LEVELS = Object.freeze(['none', 'minor', 'major']);

export function spoilerLevel(record) { return record?.spoilerLevel || 'none'; }
export function isMajorSpoiler(record) { return spoilerLevel(record) === 'major'; }
export function hasMinorSpoiler(record) { return spoilerLevel(record) === 'minor'; }
export function isSafeForDiscovery(record) { return !isMajorSpoiler(record); }

export function entitySafeProjection(entity) {
  return isMajorSpoiler(entity)
    ? { displayName: entity.safeDisplayName, summary: entity.safeSummary, concealed: true }
    : { displayName: entity.displayName, summary: entity.summary, concealed: false };
}

export function guideSafeProjection(guide) {
  return isMajorSpoiler(guide.data)
    ? { title: guide.data.safeTitle, description: guide.data.safeDescription, concealed: true }
    : { title: guide.data.title, description: guide.data.description, concealed: false };
}

export function factIsConcealed(fact, entity) { return isMajorSpoiler(entity) || isMajorSpoiler(fact); }
export function mediaIsConcealed(media, entity) { return isMajorSpoiler(entity) || isMajorSpoiler(media); }
export function relationIsConcealed(relation, knowledge) {
  return isMajorSpoiler(knowledge.entityById.get(relation.sourceEntityId)) || isMajorSpoiler(knowledge.entityById.get(relation.targetEntityId));
}

export const spoilerDisclosureLabel = '显示重大剧情内容';

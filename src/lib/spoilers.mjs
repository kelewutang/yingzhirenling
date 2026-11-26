import { siteLifecycle } from './site-lifecycle.mjs';

export const SPOILER_LEVELS = Object.freeze(['none', 'minor', 'major']);

// Editorial publication decision, independent of Fact verification and media rights.
export const postReleaseGuideDecision = Object.freeze({
  mode: 'open-guides',
  approvedBy: 'Owner',
  approvedAt: '2026-11-26',
  evidenceRef: 'docs/POST-RELEASE-OPEN-GUIDES-2026-11-26.md'
});

export function spoilerProtectionApplies(state = siteLifecycle.state, decision = postReleaseGuideDecision) {
  return !(state === 'released' && decision?.mode === 'open-guides' && decision.approvedBy === 'Owner' &&
    decision.approvedAt === '2026-11-26' && decision.evidenceRef === 'docs/POST-RELEASE-OPEN-GUIDES-2026-11-26.md');
}

export function spoilerLevel(record) { return record?.spoilerLevel || 'none'; }
export function isMajorSpoiler(record) { return spoilerLevel(record) === 'major'; }
export function shouldConcealSpoiler(record, state = siteLifecycle.state, decision = postReleaseGuideDecision) {
  return spoilerProtectionApplies(state, decision) && isMajorSpoiler(record);
}
export function hasMinorSpoiler(record) { return spoilerProtectionApplies() && spoilerLevel(record) === 'minor'; }
export function isSafeForDiscovery(record) { return !shouldConcealSpoiler(record); }

export function entitySafeProjection(entity) {
  return shouldConcealSpoiler(entity)
    ? { displayName: entity.safeDisplayName, summary: entity.safeSummary, concealed: true }
    : { displayName: entity.displayName, summary: entity.summary, concealed: false };
}

export function guideSafeProjection(guide) {
  return shouldConcealSpoiler(guide.data)
    ? { title: guide.data.safeTitle, description: guide.data.safeDescription, concealed: true }
    : { title: guide.data.title, description: guide.data.description, concealed: false };
}

export function factIsConcealed(fact, entity) { return shouldConcealSpoiler(entity) || shouldConcealSpoiler(fact); }
export function mediaIsConcealed(media, entity) { return shouldConcealSpoiler(entity) || shouldConcealSpoiler(media); }
export function relationIsConcealed(relation, knowledge) {
  return shouldConcealSpoiler(relation) || (relation.basisFactIds || []).some((id) => shouldConcealSpoiler(knowledge.factById?.get(id))) ||
    shouldConcealSpoiler(knowledge.entityById.get(relation.sourceEntityId)) || shouldConcealSpoiler(knowledge.entityById.get(relation.targetEntityId));
}

export const spoilerDisclosureLabel = '显示重大剧情内容';

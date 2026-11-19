import { relationWindowsOverlap } from './relations.mjs';

export const soulKeys = new Set(['weapon.soulForgedName', 'weapon.soulForgeEffect', 'weapon.formSet']);
export const activeFormFact = (fact) => fact.supersededBy === null && fact.validToVersionId === null && fact.status !== 'pending-review';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const only = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const rights = new Set(['permission-recorded', 'official-press-use-reviewed', 'self-captured-reviewed', 'official-promotional-risk-accepted']);
const scopeContains = (outer, inner) => ['platforms', 'difficulties'].every((key) => outer?.[key]?.mode === 'all' ||
  (inner?.[key]?.mode === 'include' && inner[key].ids.every((id) => outer?.[key]?.ids?.includes(id))));

/** Validate explicit references, never infer shared skills from a label or a level. */
export function validateWeaponForms(entity, { sourceById, versionById, mediaRecords = [] }) {
  const errors = [];
  const fail = (message) => errors.push(`${entity.id}: ${message}`);
  const byId = new Map(entity.facts.map((fact) => [fact.id, fact]));
  const current = entity.facts.filter(activeFormFact);
  for (const fact of entity.facts) {
    if (fact.sourceIds?.some((id) => sourceById.get(id)?.locator?.type === 'user-supplied-statement') && fact.key !== 'weapon.soulForgedName') {
      fail(`${fact.id}: Owner statement may support a name, not technical game facts`);
    }
    if (!soulKeys.has(fact.key)) continue;
    if (!fact.sourceIds?.length || fact.sourceIds.some((id) => !sourceById.has(id))) fail(`${fact.id}: missing Source`);
    if (!versionById.has(fact.gameVersionId)) fail(`${fact.id}: missing GameVersion`);
    if (fact.key === 'weapon.soulForgedName' && (!text(fact.value) || fact.value.length > 80)) fail(`${fact.id}: invalid forged name`);
    if (fact.key === 'weapon.soulForgeEffect' && (!only(fact.value, ['name', 'description']) ||
      !text(fact.value.name) || !text(fact.value.description) || fact.value.name.length > 80 || fact.value.description.length > 650)) fail(`${fact.id}: effect requires only name and description; no progression level`);
  }
  for (const key of soulKeys) {
    const candidates = entity.facts.filter((fact) => fact.key === key && fact.supersededBy === null && fact.status !== 'pending-review');
    for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
      if (relationWindowsOverlap(candidates[i], candidates[j], versionById)) fail(`${key}: conflicting effective version/scope`);
    }
  }
  for (const set of entity.facts.filter((fact) => fact.key === 'weapon.formSet')) {
    const value = set.value;
    if (!only(value, ['base', 'soulForged', 'mechanics', 'progressionNodes', 'effectFactId'])) { fail(`${set.id}: invalid form set`); continue; }
    const ref = (id, key) => {
      const fact = byId.get(id);
      if (!fact || fact.key !== key) { fail(`${set.id}: invalid own-entity ${key} reference ${id}`); return null; }
      const sequence = versionById.get(set.gameVersionId)?.sequence;
      const from = versionById.get(fact.validFromVersionId || fact.gameVersionId)?.sequence;
      const to = fact.validToVersionId ? versionById.get(fact.validToVersionId)?.sequence : Infinity;
      if (fact.status === 'pending-review' || fact.supersededBy !== null || !(from <= sequence && sequence < to) || !scopeContains(fact.scope, set.scope)) fail(`${set.id}: incompatible Fact status/version/scope ${id}`);
      if (!fact.sourceIds?.length || fact.sourceIds.some((id) => !sourceById.has(id))) fail(`${id}: missing Source`);
      if (fact.spoilerLevel === 'major' && set.spoilerLevel !== 'major') fail(`${set.id}: form set cannot downgrade major spoiler ${id}`);
      return fact;
    };
    const media = [];
    for (const form of ['base', 'soulForged']) {
      const entry = value[form];
      if (!only(entry, ['nameFactId', 'descriptionFactId', 'mediaId', 'baseStatFactIds'])) { fail(`${set.id}: invalid ${form}`); continue; }
      const name = ref(entry.nameFactId, form === 'base' ? 'weapon.name' : 'weapon.soulForgedName');
      if (form === 'base' && name && name.value !== entity.displayName) fail(`${set.id}: base name must preserve canonical identity`);
      ref(entry.descriptionFactId, 'weapon.description');
      if (!Array.isArray(entry.baseStatFactIds) || !entry.baseStatFactIds.length || new Set(entry.baseStatFactIds).size !== entry.baseStatFactIds.length) fail(`${set.id}: explicit ${form} stats required`);
      else {
        const stats = entry.baseStatFactIds.map((id) => ref(id, 'weapon.baseStat')).filter(Boolean);
        if (new Set(stats.map((fact) => fact.value.displayedLevel)).size > 1 || new Set(stats.map((fact) => fact.value.statName)).size !== stats.length) fail(`${set.id}: mixed displayed levels or repeated stats within ${form}`);
      }
      const image = mediaRecords.find((item) => item.id === entry.mediaId);
      if (!image || image.entityId !== entity.id || image.recordState !== 'published' || !rights.has(image.rightsStatus) ||
        !image.usage?.includes('hero') || (image.weaponForm || 'base') !== form || !sourceById.has(image.sourceId) ||
        sourceById.get(image.sourceId)?.locator?.type === 'user-supplied-statement') fail(`${set.id}: invalid independent ${form} Media`);
      if (image?.spoilerLevel === 'major' && set.spoilerLevel !== 'major') fail(`${set.id}: form set cannot downgrade major Media`);
      media.push(image);
    }
    if (media[0] && media[1] && (media[0].id === media[1].id || media[0].src === media[1].src)) fail(`${set.id}: forged appearance cannot reuse base image`);
    ref(value.effectFactId, 'weapon.soulForgeEffect');
    for (const [field, key] of [['mechanics', 'weapon.mechanic'], ['progressionNodes', 'weapon.progressionNode']]) {
      const mappings = value[field];
      if (!Array.isArray(mappings) || !mappings.length) { fail(`${set.id}: explicit ${field} mappings required`); continue; }
      const identities = new Set(), used = new Set();
      for (const item of mappings) {
        if (!only(item, ['logicalId', 'change', 'baseFactId', 'soulForgedFactId']) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.logicalId) || identities.has(item.logicalId)) { fail(`${set.id}: invalid/repeated logical identity`); continue; }
        identities.add(item.logicalId);
        const { baseFactId: a, soulForgedFactId: b, change } = item;
        const valid = change === 'shared' ? text(a) && a === b : change === 'modified' ? text(a) && text(b) && a !== b : change === 'added' ? a === null && text(b) : change === 'removed' ? text(a) && b === null : false;
        if (!valid) fail(`${set.id}: invalid explicit ${change} mapping`);
        for (const id of new Set([a, b].filter(Boolean))) {
          if (used.has(id)) fail(`${set.id}: Fact mapped under multiple logical identities ${id}`);
          used.add(id); ref(id, key);
        }
      }
      if (activeFormFact(set)) for (const fact of current.filter((fact) => fact.key === key && scopeContains(fact.scope, set.scope))) {
        if (!used.has(fact.id)) fail(`${set.id}: unmapped active ${key} ${fact.id}`);
      }
    }
  }
  return errors;
}

export function searchableForgedNames(entity) {
  if (entity.recordState !== 'published' || entity.spoilerLevel === 'major') return [];
  return entity.facts.filter((fact) => fact.key === 'weapon.soulForgedName' && activeFormFact(fact) && fact.spoilerLevel !== 'major').map((fact) => fact.value);
}

/** The set determines both forms explicitly; unknown changes never inherit. */
export function resolveWeaponForms(entity) {
  if (entity.recordState !== 'published') return null;
  const sets = entity.facts.filter((fact) => fact.key === 'weapon.formSet' && activeFormFact(fact));
  if (!sets.length) return null;
  if (sets.length !== 1) throw new Error(`${entity.id}: ambiguous current form scope`);
  const set = sets[0], byId = new Map(entity.facts.map((fact) => [fact.id, fact]));
  const forms = {};
  for (const form of ['base', 'soulForged']) {
    const entry = set.value[form];
    const changes = (field) => set.value[field].filter((item) => item[`${form}FactId`])
      .map((item) => ({ ...byId.get(item[`${form}FactId`]), formChange: form === 'soulForged' && item.change !== 'shared' ? item.change : null, logicalId: item.logicalId }))
      .sort((a, b) => field === 'progressionNodes' ? (a.value.level ?? Infinity) - (b.value.level ?? Infinity) : 0);
    forms[form] = {
      name: byId.get(entry.nameFactId).value,
      mediaId: entry.mediaId,
      entity: { ...entity, displayName: byId.get(entry.nameFactId).value, facts: [
        ...entity.facts.filter((fact) => !['weapon.description', 'weapon.baseStat', 'weapon.mechanic', 'weapon.progressionNode', ...soulKeys].includes(fact.key)),
        byId.get(entry.descriptionFactId), ...entry.baseStatFactIds.map((id) => byId.get(id)),
        ...changes('mechanics'), ...changes('progressionNodes'),
        ...(form === 'soulForged' ? [byId.get(set.value.effectFactId)] : [])
      ] }
    };
  }
  return { ...set, forms };
}

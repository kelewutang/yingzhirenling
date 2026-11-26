import { shouldConcealSpoiler } from './spoilers.mjs';
import { isDeepStrictEqual } from 'node:util';

export const pcDetailsSourceId = 'source:owner-pc-baiying-lingshe-2026-11-23';
export const pcDetailsVersionId = 'version:release-pc-baiying-lingshe-2026-11-23';
const resourceSourceId = 'source:owner-pc-baiying-lingshe-resource-2026-11-23';
const weaponIds = new Set(['weapon:white-shadow', 'weapon:soft-snake-sword']);
const resourceFactIds = new Set(['fact:weapon:white-shadow:pc-20261123-howls', 'fact:weapon:soft-snake-sword:pc-20261123-dance']);
const scope = { platforms: { mode: 'include', ids: ['platform:pc'] }, difficulties: { mode: 'all', ids: [] } };
const current = (fact) => fact.supersededBy === null && fact.validToVersionId === null;
export const isPcDetailsFact = (fact) => fact?.gameVersionId === pcDetailsVersionId || fact?.sourceIds?.includes(pcDetailsSourceId);
export const isIndependentPcEffect = (entity, fact) => weaponIds.has(entity.id) &&
  fact.key === 'weapon.soulForgeEffect' && fact.id === `fact:${entity.id}:pc-20261123-effect` && isPcDetailsFact(fact);

// This testimony names a pictured resource only; it cannot supply amounts or effects.
export function isPcResourceConfirmation(fact, source) {
  const locator = source?.locator;
  return resourceFactIds.has(fact?.id) && fact.key === 'weapon.mechanic' && fact.gameVersionId === pcDetailsVersionId &&
    fact.sourceIds?.includes(pcDetailsSourceId) && source?.id === resourceSourceId && source.sourceType === 'owner-confirmation' &&
    source.authority === 'community' && locator?.type === 'user-supplied-statement' &&
    locator.screenshotSourceId === pcDetailsSourceId && locator.gameVersionId === pcDetailsVersionId &&
    locator.resourceName === '精纯杀气' && locator.confirmedAt === '2026-11-23' &&
    isDeepStrictEqual(locator.factIds, [...resourceFactIds]);
}

/** Admit only this two-weapon screenshot batch, with independent effectFactId evidence. */
export function validatePcWeaponDetails(entity, { sourceById, versionById }) {
  const facts = entity.facts.filter(isPcDetailsFact);
  if (!facts.length) return [];
  const errors = [], fail = (message) => errors.push(`${entity.id}: ${message}`);
  const source = sourceById?.get(pcDetailsSourceId), version = versionById?.get(pcDetailsVersionId);
  const locator = source?.locator;
  const publicRecord = (record) => record && !['draft', 'archived'].includes(record.recordState) && !shouldConcealSpoiler(record);
  if (!weaponIds.has(entity.id) || source?.sourceType !== 'user-game-screenshot' || source.authority !== 'community' || !publicRecord(source) ||
      locator?.type !== 'user-supplied-game-screenshot' || locator.platformId !== 'platform:pc' ||
      locator.versionLabel !== null || locator.suppliedAt !== '2026-11-23' ||
      version?.track !== 'release' || version.versionLabel !== null || version.checkedAt !== '2026-11-23' ||
      !isDeepStrictEqual(version.platformIds, ['platform:pc']) || !isDeepStrictEqual(version.sourceIds, [pcDetailsSourceId]) ||
      !Array.isArray(locator.evidenceItems) || locator.evidenceItems.length !== 7 ||
      !Array.isArray(locator.weaponClaims) || !Array.isArray(locator.weaponEffects) || locator.weaponEffects.length !== 2) {
    fail('invalid independent PC screenshot batch/version');
    return errors;
  }
  const items = new Map(locator.evidenceItems.map((item) => [item?.id, item]));
  const claims = locator.weaponClaims.filter((claim) => claim?.weaponId === entity.id);
  if (claims.length !== facts.length || new Set(claims.map((claim) => claim.factId)).size !== facts.length) fail('unmapped or duplicate PC screenshot claim');
  for (const fact of facts) {
    const matches = claims.filter((claim) => claim?.factId === fact.id), claim = matches[0];
    const resource = resourceFactIds.has(fact.id), confirmation = sourceById.get(resourceSourceId);
    const expected = structuredClone(claim?.value);
    if (resource && typeof expected?.description === 'string') expected.description = expected.description.replace('消耗1［紫色图标］', '消耗1精纯杀气');
    if (matches.length !== 1 || !fact.id.startsWith(`fact:${entity.id}:pc-20261123-`) || claim.key !== fact.key || !isDeepStrictEqual(fact.value, expected) || !current(fact) ||
        fact.status !== 'observation' || fact.checkedAt !== '2026-11-23' || fact.gameVersionId !== pcDetailsVersionId ||
        fact.validFromVersionId !== pcDetailsVersionId || !isDeepStrictEqual(fact.scope, scope) ||
        !isDeepStrictEqual(fact.sourceIds, resource ? [pcDetailsSourceId, resourceSourceId] : [pcDetailsSourceId]) ||
        (resource && (!publicRecord(confirmation) || !isPcResourceConfirmation(fact, confirmation) || !claim?.value?.description?.includes('消耗1［紫色图标］'))) ||
        !Array.isArray(claim?.locations) || !claim.locations.length || claim.locations.some((location) => {
          const item = items.get(location?.evidenceItemId);
          return typeof location?.position !== 'string' || !location.position.trim() || item?.weaponId !== entity.id || !/^[a-f0-9]{64}$/.test(item?.sha256 ?? '');
        })) fail(`${fact.id}: independent Fact does not match reviewed screenshot evidence`);
  }
  const effect = facts.find((fact) => isIndependentPcEffect(entity, fact));
  const bindings = locator.weaponEffects.filter((entry) => entry?.weaponId === entity.id);
  if (!effect || facts.filter((fact) => fact.key === 'weapon.soulForgeEffect').length !== 1 || bindings.length !== 1 ||
      bindings[0].effectFactId !== effect.id || bindings[0].gameVersionId !== pcDetailsVersionId) fail('invalid independent effectFactId binding');
  if (entity.facts.some((fact) => ['weapon.formSet', 'weapon.soulForgedName'].includes(fact.key))) fail('independent effects must not create weapon forms');
  const nodes = facts.filter((fact) => fact.key === 'weapon.progressionNode');
  if (!isDeepStrictEqual(nodes.map((fact) => fact.value.level).sort((a, b) => a - b), [5, 15, 25, 30]) ||
      facts.filter((fact) => fact.key === 'weapon.baseStat').length !== 2 ||
      facts.filter((fact) => fact.key === 'weapon.baseStat').some((fact) => fact.value.displayedLevel !== 30)) fail('expected two Lv30 stats and four screenshot growth levels');
  return errors;
}

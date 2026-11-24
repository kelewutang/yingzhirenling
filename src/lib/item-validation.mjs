import { isDeepStrictEqual } from 'node:util';

const kinds = { accessory: ['生存类饰品', '攻击类饰品', '辅助类饰品'], flask: ['回复药', '秘药'] };
// Additional item checks retain the existing Fact/Source/Version validation.
export function validateItem(entity, sources, versions, report) {
  const type = entity.entityType;
  if (!Object.hasOwn(kinds, type)) return;
  const fail = (message) => report(entity.id, message);
  const expectedKeys = ['name', 'kind', 'level', 'effect', 'description', ...(type === 'flask' ? ['uses'] : [])].map((key) => `${type}.${key}`);
  const active = (entity.facts ?? []).filter((fact) => fact.supersededBy === null && fact.validToVersionId === null);
  for (const fact of entity.facts ?? []) if (!expectedKeys.includes(fact.key)) fail(`Unsupported item Fact: ${fact.key}`);
  if (entity.recordState !== 'published') return;
  for (const key of expectedKeys) if (active.filter((fact) => fact.key === key).length !== 1) fail(`Published item requires one active ${key}`);
  const value = (key) => active.find((fact) => fact.key === `${type}.${key}`)?.value;
  if (value('name') !== entity.displayName) fail('Item name must equal the source-backed displayName');
  if (!kinds[type].includes(value('kind'))) fail('Item category must use the screenshot taxonomy');
  if (!(type === 'accessory' ? /^\+\d+$/ : /^[1-9]\d*$/).test(String(value('level') ?? ''))) fail('Item level must be an explicit screenshot level; no inferred maximum');
  if (type === 'flask' && !/^[1-9]\d*$/.test(String(value('uses') ?? ''))) fail('Flask uses must be a positive displayed count, independent of level');
  const effect = active.find((fact) => fact.key === `${type}.effect`);
  if (!effect || entity.summary !== effect.value || !isDeepStrictEqual(entity.summaryFactIds, [effect.id])) fail('Item summary must retain its complete source-backed effect');
  for (const fact of active) {
    if (typeof fact.value !== 'string' || !fact.value.trim()) fail(`Item Fact must retain nonempty screenshot text: ${fact.key}`);
    if (fact.status !== 'observation' || versions.get(fact.gameVersionId)?.track !== 'release' ||
        fact.scope?.platforms?.mode !== 'include' || !isDeepStrictEqual(fact.scope.platforms.ids, ['platform:pc'])) fail(`Item Fact must retain the PC release screenshot observation scope: ${fact.key}`);
    if (fact.sourceIds?.length !== 1) { fail(`Item Fact requires one exact screenshot Source: ${fact.key}`); continue; }
    const source = sources.get(fact.sourceIds[0]);
    const locator = source?.locator;
    if (source?.sourceType !== 'user-game-screenshot' || source.authority !== 'community' || ['draft', 'archived'].includes(source.recordState) || locator?.type !== 'user-supplied-game-screenshot' || locator.platformId !== 'platform:pc' || !versions.get(fact.gameVersionId)?.sourceIds.includes(source.id)) { fail(`Item Source/Version mismatch: ${fact.key}`); continue; }
    const claims = locator.itemClaims?.filter((claim) => claim.factId === fact.id) ?? [];
    if (claims.length !== 1) { fail(`Item Fact requires one exact claim binding: ${fact.key}`); continue; }
    const claim = claims[0];
    const image = locator.evidenceItems?.find((item) => item.id === claim.evidenceItemId);
    const field = fact.key.slice(type.length + 1);
    if (claim.entityId !== entity.id || claim.key !== fact.key || !isDeepStrictEqual(claim.value, fact.value) ||
        !claim.position?.trim() || image?.entityId !== entity.id || !/^[a-f0-9]{64}$/.test(image?.sha256 ?? '') ||
        !isDeepStrictEqual(image?.readableText?.[field], fact.value)) fail(`Item Fact/text/hash evidence mismatch: ${fact.key}`);
  }
}

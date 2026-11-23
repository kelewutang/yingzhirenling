// Synthetic ASCII data: tests only. Never imported by production pages/loaders.
export function weaponFormsFixture() {
  const scope = { platforms: { mode: 'include', ids: ['platform:pc'] }, difficulties: { mode: 'all', ids: [] } };
  const entity = { id: 'weapon:fixture-soul', entityType: 'weapon', slug: 'fixture-soul', displayName: 'Base fixture', recordState: 'published', spoilerLevel: 'none', facts: [] };
  const baseSourceId = 'source:fixture-screenshot';
  const forgedSourceId = 'source:fixture-forged-screenshot';
  const gameplaySourceId = 'source:fixture-soul-gameplay';
  const fact = (id, key, value, sourceIds = [baseSourceId]) => {
    const item = { id: `fact:weapon:fixture-soul:${id}`, key, value, valueType: typeof value === 'object' ? 'object' : 'string', status: 'observation', scope: structuredClone(scope), sourceIds, basisFactIds: [], gameVersionId: 'version:fixture-v2', validFromVersionId: 'version:fixture-v2', validToVersionId: null, supersededBy: null, checkedAt: '2026-11-18', reviewNote: null, spoilerLevel: 'none' };
    entity.facts.push(item); return item.id;
  };
  const baseName = fact('base-name', 'weapon.name', 'Base fixture');
  const forgedName = fact('forged-name', 'weapon.soulForgedName', 'Forged fixture', [forgedSourceId]);
  const baseDescription = fact('description', 'weapon.description', 'Synthetic base description');
  const forgedDescription = fact('forged-description', 'weapon.description', 'Synthetic forged description', [forgedSourceId]);
  fact('category', 'weapon.systemCategory', 'Main weapon');
  const stat = (id, level, amount) => fact(id, 'weapon.baseStat', { statName: 'Damage', displayedValue: amount, displayedLevel: level, displayContext: 'release-game-ui' });
  const baseStat = stat('base-stat', 1, 100), forgedStat = stat('forged-stat', 5, 150);
  const moves = [], nodes = [];
  for (const [field, key, output] of [['move', 'weapon.mechanic', moves], ['node', 'weapon.progressionNode', nodes]]) {
    for (const [index, change] of ['shared', 'modified', 'added', 'removed'].entries()) {
      const value = (name) => ({ name, description: name + ' description', input: 'L2', ...(field === 'node' && index !== 2 ? { level: [5, 10, 15, 25][index] } : {}) });
      const a = change === 'added' ? null : fact(`${field}-${change}-base`, key, value(`${field} same label`),
        change === 'shared' ? [baseSourceId, forgedSourceId, gameplaySourceId] : [baseSourceId]);
      const b = change === 'removed' ? null : change === 'shared' ? a : fact(`${field}-${change}-forged`, key, value(`${field} same label`), [forgedSourceId, gameplaySourceId]);
      output.push({ logicalId: `${field}-${index}`, change, baseFactId: a, soulForgedFactId: b });
    }
  }
  const effect = fact('effect', 'weapon.soulForgeEffect', { name: 'Fixture soul effect', description: 'Synthetic forged effect description' });
  fact('form-set', 'weapon.formSet', {
    base: { nameFactId: baseName, descriptionFactId: baseDescription, mediaId: 'media:fixture-base', baseStatFactIds: [baseStat] },
    soulForged: { nameFactId: forgedName, descriptionFactId: forgedDescription, mediaId: 'media:fixture-forged', baseStatFactIds: [forgedStat] },
    mechanics: moves, progressionNodes: nodes, effectFactId: effect
  }, [gameplaySourceId]);
  const mediaRecords = ['base', 'soulForged'].map((form, i) => ({ id: i ? 'media:fixture-forged' : 'media:fixture-base', entityId: entity.id, weaponForm: form, recordState: 'published', rightsStatus: 'self-captured-reviewed', usage: ['hero', 'card'], sourceId: i ? forgedSourceId : baseSourceId, src: `fixture-${i}.jpg` }));
  const sourceById = new Map([baseSourceId, forgedSourceId, gameplaySourceId].map((id) => [id, { sourceType: 'user-game-screenshot', locator: { type: 'user-supplied-game-screenshot' } }]));
  const knowledge = { sourceById, versionById: new Map([['version:fixture-v1', { sequence: 1 }], ['version:fixture-v2', { sequence: 2 }], ['version:fixture-v3', { sequence: 3 }]]), platformById: new Map(), difficultyById: new Map(), mediaRecords };
  return { entity, knowledge };
}

// Rejected input retained for the R4 regression.
export function partialWeaponFormsFixture() {
  const fixture = weaponFormsFixture();
  const { entity } = fixture, set = entity.facts.at(-1), value = set.value;
  value.soulForged.completeness = { description: 'pending', baseStats: 'pending', mechanics: 'partial', progressionNodes: 'pending', soulForgeEffects: 'pending' };
  value.soulForged.descriptionFactId = null;
  value.soulForged.baseStatFactIds = [];
  value.effectFactId = null;
  for (const field of ['mechanics', 'progressionNodes']) {
    value[field] = value[field].filter((row) => row.baseFactId).map((row, index) => field === 'mechanics' && index === 0 ? row : { ...row, change: 'unverified', soulForgedFactId: null });
  }
  const retained = new Set([set.id, value.base.nameFactId, value.soulForged.nameFactId, value.base.descriptionFactId, ...value.base.baseStatFactIds, ...['mechanics', 'progressionNodes'].flatMap((field) => value[field].flatMap((row) => [row.baseFactId, row.soulForgedFactId]))]);
  entity.facts = entity.facts.filter((fact) => retained.has(fact.id) || fact.key === 'weapon.systemCategory');
  return fixture;
}

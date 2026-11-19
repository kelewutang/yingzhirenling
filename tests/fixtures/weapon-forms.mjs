// Synthetic ASCII data: tests only. Never imported by production pages/loaders.
export function weaponFormsFixture() {
  const scope = { platforms: { mode: 'include', ids: ['platform:pc'] }, difficulties: { mode: 'all', ids: [] } };
  const entity = { id: 'weapon:fixture-soul', entityType: 'weapon', slug: 'fixture-soul', displayName: 'Base fixture', recordState: 'published', spoilerLevel: 'none', facts: [] };
  const fact = (id, key, value) => {
    const item = { id: `fact:weapon:fixture-soul:${id}`, key, value, valueType: typeof value === 'object' ? 'object' : 'string', status: 'observation', scope: structuredClone(scope), sourceIds: ['source:fixture-screenshot'], basisFactIds: [], gameVersionId: 'version:fixture-v2', validFromVersionId: 'version:fixture-v2', validToVersionId: null, supersededBy: null, checkedAt: '2026-11-18', reviewNote: null, spoilerLevel: 'none' };
    entity.facts.push(item); return item.id;
  };
  const baseName = fact('base-name', 'weapon.name', 'Base fixture');
  const forgedName = fact('forged-name', 'weapon.soulForgedName', 'Forged fixture');
  const description = fact('description', 'weapon.description', 'Synthetic description');
  fact('category', 'weapon.systemCategory', 'Main weapon');
  const stat = (id, level, amount) => fact(id, 'weapon.baseStat', { statName: 'Damage', displayedValue: amount, displayedLevel: level, displayContext: 'release-game-ui' });
  const baseStat = stat('base-stat', 1, 100), forgedStat = stat('forged-stat', 5, 150);
  const moves = [], nodes = [];
  for (const [field, key, output] of [['move', 'weapon.mechanic', moves], ['node', 'weapon.progressionNode', nodes]]) {
    for (const [index, change] of ['shared', 'modified', 'added', 'removed'].entries()) {
      const value = (name) => ({ name, description: name + ' description', input: 'L2', ...(field === 'node' && index !== 2 ? { level: [5, 10, 15, 25][index] } : {}) });
      const a = change === 'added' ? null : fact(`${field}-${change}-base`, key, value(`${field} same label`));
      const b = change === 'removed' ? null : change === 'shared' ? a : fact(`${field}-${change}-forged`, key, value(`${field} same label`));
      output.push({ logicalId: `${field}-${index}`, change, baseFactId: a, soulForgedFactId: b });
    }
  }
  const effect = fact('effect', 'weapon.soulForgeEffect', { name: 'Fixture soul effect', description: 'Synthetic forged effect description' });
  fact('form-set', 'weapon.formSet', {
    base: { nameFactId: baseName, descriptionFactId: description, mediaId: 'media:fixture-base', baseStatFactIds: [baseStat] },
    soulForged: { nameFactId: forgedName, descriptionFactId: description, mediaId: 'media:fixture-forged', baseStatFactIds: [forgedStat] },
    mechanics: moves, progressionNodes: nodes, effectFactId: effect
  });
  const mediaRecords = ['base', 'soulForged'].map((form, i) => ({ id: i ? 'media:fixture-forged' : 'media:fixture-base', entityId: entity.id, weaponForm: form, recordState: 'published', rightsStatus: 'self-captured-reviewed', usage: ['hero', 'card'], sourceId: 'source:fixture-screenshot', src: `fixture-${i}.jpg` }));
  const knowledge = { sourceById: new Map([['source:fixture-screenshot', { sourceType: 'user-game-screenshot', locator: { type: 'user-supplied-game-screenshot' } }]]), versionById: new Map([['version:fixture-v1', { sequence: 1 }], ['version:fixture-v2', { sequence: 2 }], ['version:fixture-v3', { sequence: 3 }]]), platformById: new Map(), difficultyById: new Map(), mediaRecords };
  return { entity, knowledge };
}

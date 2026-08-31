const labels = { weapon: '武器', character: '角色', boss: 'BOSS', location: '地点' };
const quickKeys = {
  weapon: ['weapon.kind', 'weapon.publicAppearance', 'weapon.observedTrait'],
  character: ['character.role', 'character.exists'],
  boss: ['boss.kind', 'boss.publicAppearance'],
  location: ['location.kind', 'location.publicAppearance', 'location.observedTrait']
};

export function buildEntityDetailModel(entity, facts) {
  const quick = facts.filter((fact) => quickKeys[entity.entityType]?.includes(fact.key)).slice(0, 5);
  return {
    eyebrow: quick.find((fact) => fact.key.endsWith('.kind')) ? `${labels[entity.entityType]} · ${quick.find((fact) => fact.key.endsWith('.kind')).valueText}` : labels[entity.entityType],
    facts: { quick, detail: facts }
  };
}

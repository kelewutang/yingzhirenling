import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const statusLabels = {
  official: '官方确认',
  observation: '试玩观察',
  'third-party': '第三方信息',
  editorial: '编辑推测',
  'pending-review': '待后续核查'
};
const sourceTypeLabels = {
  'official-article': '官方发布材料',
  'media-hands-on': '媒体试玩',
  'media-demo-report': '媒体试玩',
  'media-gameplay-video': '媒体实机视频'
};
let cached;

async function readDirectory(relativePath) {
  const directory = resolve(root, relativePath);
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
}

export async function loadKnowledge() {
  cached ??= Promise.all([
    readDirectory('data/weapons'),
    readDirectory('data/characters'),
    readDirectory('data/bosses'),
    readDirectory('data/locations'),
    readDirectory('data/relations'),
    readDirectory('data/sources'),
    readDirectory('data/versions')
  ]).then(([weapons, characters, bosses, locations, relations, sources, versions]) => {
    const entities = [...weapons, ...characters, ...bosses, ...locations];
    return {
      weapons,
      characters,
      bosses,
      locations,
      relations,
      sourceById: new Map(sources.map((item) => [item.id, item])),
      versionById: new Map(versions.map((item) => [item.id, item])),
      entityById: new Map(entities.map((item) => [item.id, item]))
    };
  });
  return cached;
}

export function getPublishedWeapons(knowledge) {
  return knowledge.weapons.filter((item) => item.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

export function getPublishedCharacters(knowledge) {
  return knowledge.characters.filter((item) => item.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

export function getPublishedBosses(knowledge) {
  return knowledge.bosses.filter((item) => item.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

export function getPublishedLocations(knowledge) {
  return knowledge.locations.filter((item) => item.recordState === 'published').sort((a, b) => a.id.localeCompare(b.id));
}

export function statusLabel(status) {
  if (status === 'release-verified') throw new Error('release-verified is prohibited before release');
  if (!statusLabels[status]) throw new Error(`Unsupported status: ${status}`);
  return statusLabels[status];
}

export function sourceTypeLabel(type) {
  return sourceTypeLabels[type] || type;
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function getFact(entity, key) {
  return entity.facts.find((fact) => fact.key === key) || null;
}

export function aliasValues(entity) {
  return entity.aliases.map((alias) => alias.value);
}

export function versionLabel(id, knowledge) {
  return knowledge.versionById.get(id)?.displayName || '当前公开资料阶段';
}

export function collectDisplayedSources(facts, knowledge, relations = []) {
  const ids = [...new Set([
    ...facts.flatMap((fact) => fact.sourceIds),
    ...relations.flatMap((relation) => relation.sourceIds)
  ])].sort();
  const urls = new Set();
  return ids.map((id) => knowledge.sourceById.get(id)).filter((source) => {
    if (!source || urls.has(source.url)) return false;
    urls.add(source.url);
    return true;
  });
}

export function getProductionRelationsForEntity(entityId, knowledge) {
  return knowledge.relations
    .filter((relation) => relation.validToVersionId === null)
    .filter((relation) => relation.sourceEntityId === entityId || relation.targetEntityId === entityId)
    .filter((relation) => {
      const source = knowledge.entityById.get(relation.sourceEntityId);
      const target = knowledge.entityById.get(relation.targetEntityId);
      return source?.recordState === 'published' && target?.recordState === 'published';
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = resolve(fileURLToPath(new URL('../../../../../', import.meta.url)));
const previewCharacterIds = [
  'character:soul',
  'character:mo-yuan',
  'character:the-hunt'
];
const statusLabels = {
  official: '官方确认',
  observation: '试玩观察',
  'third-party': '第三方信息',
  editorial: '编辑推测',
  'pending-review': '待后续核查'
};
const sourceTypeLabels = {
  'official-article': '官方发布材料',
  'media-demo-report': '媒体试玩'
};
let cachedKnowledge;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonDirectory(relativePath) {
  const directory = resolve(repositoryRoot, relativePath);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(entries.map((entry) => readJson(resolve(directory, entry))));
}

function createMap(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function requireSupportedStatus(status) {
  if (status === 'release-verified') {
    throw new Error('release-verified is prohibited in this pre-release POC');
  }
  if (!statusLabels[status]) throw new Error(`Unsupported status: ${status}`);
  return statusLabels[status];
}

export async function loadKnowledge() {
  if (!cachedKnowledge) {
    cachedKnowledge = Promise.all([
      readJsonDirectory('data/weapons'),
      readJsonDirectory('data/characters'),
      readJsonDirectory('data/relations'),
      readJsonDirectory('data/sources'),
      readJsonDirectory('data/versions')
    ]).then(([weapons, characters, relations, sources, versions]) => {
      const entities = [...weapons, ...characters];
      return {
        weapons,
        characters,
        relations,
        sources,
        versions,
        entityById: createMap(entities),
        sourceById: createMap(sources),
        versionById: createMap(versions)
      };
    });
  }
  return cachedKnowledge;
}

export function getPublishedWeapons(knowledge) {
  return knowledge.weapons
    .filter((weapon) => weapon.recordState === 'published')
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getPreviewCharacters(knowledge) {
  return previewCharacterIds.map((id) => {
    const character = knowledge.entityById.get(id);
    if (!character || character.entityType !== 'character' || character.recordState !== 'draft') {
      throw new Error(`Invalid POC preview candidate: ${id}`);
    }
    return character;
  });
}

export function statusLabel(status) {
  return requireSupportedStatus(status);
}

export function sourceTypeLabel(sourceType) {
  return sourceTypeLabels[sourceType] || sourceType;
}

export function aliasValues(entity) {
  return entity.aliases.map((alias) => alias.value);
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function sourcesForIds(sourceIds, knowledge) {
  const seenIds = new Set();
  const seenUrls = new Set();
  return sourceIds
    .slice()
    .sort()
    .map((id) => knowledge.sourceById.get(id))
    .filter((source) => {
      if (!source || seenIds.has(source.id) || seenUrls.has(source.url)) return false;
      seenIds.add(source.id);
      seenUrls.add(source.url);
      return true;
    });
}

export function collectDisplayedSources({ facts = [], relations = [], knowledge }) {
  return sourcesForIds(
    [...facts.flatMap((fact) => fact.sourceIds), ...relations.flatMap((relation) => relation.sourceIds)],
    knowledge
  );
}

export function versionLabel(versionId, knowledge) {
  return knowledge.versionById.get(versionId)?.displayName || '当前公开资料阶段';
}

export function isRelationValid(relation) {
  return relation.validToVersionId === null;
}

export function getPreviewRelations(entityId, knowledge) {
  return knowledge.relations
    .filter((relation) => relation.sourceEntityId === entityId || relation.targetEntityId === entityId)
    .filter(isRelationValid)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getProductionVisibleRelations(knowledge) {
  return knowledge.relations
    .filter(isRelationValid)
    .filter((relation) => {
      const source = knowledge.entityById.get(relation.sourceEntityId);
      const target = knowledge.entityById.get(relation.targetEntityId);
      return source?.recordState === 'published' && target?.recordState === 'published';
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getFact(entity, key) {
  return entity.facts.find((fact) => fact.key === key) || null;
}

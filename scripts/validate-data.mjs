import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'knowledge-schema-cases.json');
const CHARACTER_FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'character-schema-cases.json');
const BOSS_FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'boss-schema-cases.json');
const LOCATION_FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'location-schema-cases.json');
const RELATION_FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'relation-schema-cases.json');
const FIXTURE_MODE = process.argv.includes('--fixtures');
const SCHEMA_VERSION = '1.0-implementation';
const STATUS_VALUES = new Set([
  'official',
  'observation',
  'third-party',
  'editorial',
  'release-verified',
  'pending-review'
]);
const AUTHORITY_VALUES = new Set(['official', 'third-party', 'community', 'internal']);
const ENTITY_TYPES = new Set(['weapon', 'character', 'boss', 'location']);
const RELATION_TYPES = new Set(['parentOf', 'formerCompanionOf']);
const RECORD_STATES = new Set(['draft', 'published', 'archived']);
const RESOLUTION_TYPES = new Set(['duplicate', 'merge', 'split', 'misidentified']);
const VERSION_STAGES = new Set(['prelaunch-materials', 'prelaunch-demo']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const idOwners = new Map();

function error(location, message) {
  errors.push(`${location}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateDate(value, location, { nullable = false } = {}) {
  if (value === null && nullable) return;
  if (!isValidDate(value)) error(location, '必须是合法的 YYYY-MM-DD 日期');
}

function validateUrl(value, location, { nullable = false } = {}) {
  if (value === null && nullable) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    error(location, '必须是合法的 HTTP(S) URL');
  }
}

function registerId(id, location) {
  if (typeof id !== 'string' || id.length === 0) {
    error(location, 'id 必须是非空字符串');
    return;
  }
  if (idOwners.has(id)) {
    error(location, `id 与 ${idOwners.get(id)} 重复：${id}`);
    return;
  }
  idOwners.set(id, location);
}

async function listJsonFiles(relativeDir) {
  const directory = path.join(DATA_DIR, relativeDir);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function readJson(file) {
  const relative = path.relative(ROOT_DIR, file).replaceAll('\\', '/');
  try {
    return { relative, value: JSON.parse(await fs.readFile(file, 'utf8')) };
  } catch (cause) {
    error(relative, `JSON 无法解析：${cause.message}`);
    return { relative, value: null };
  }
}

async function readRecordDirectory(relativeDir) {
  const files = await listJsonFiles(relativeDir);
  return Promise.all(files.map(readJson));
}

function validateSchemaVersion(record, location) {
  if (record.schemaVersion !== SCHEMA_VERSION) {
    error(`${location}.schemaVersion`, `必须为 ${SCHEMA_VERSION}`);
  }
}

function validateStringArray(value, location) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    error(location, '必须是非空字符串组成的数组（数组本身可以为空）');
    return false;
  }
  return true;
}

function validateOfficialSourceRule(record, sourceIndex, location, report, recordLabel = 'Fact') {
  const sourceIds = Array.isArray(record.sourceIds) ? record.sourceIds : [];
  if (record.status === 'official' && !sourceIds.some((id) => sourceIndex.get(id)?.authority === 'official')) {
    report(`${location}.sourceIds`, `official ${recordLabel} 至少需要一个 authority=official Source`);
  }
}

function validateEntityResolutions(entityIndex, report) {
  const edges = new Map();

  for (const [entityId, { location, entity }] of entityIndex) {
    if ('supersededBy' in entity) {
      report(`${location}.supersededBy`, 'Entity 不再使用 supersededBy；身份修正只能使用 resolution');
    }
    if (!RECORD_STATES.has(entity.recordState)) {
      report(`${location}.recordState`, '必须为 draft、published 或 archived');
    }
    if (!Object.hasOwn(entity, 'resolution')) {
      report(`${location}.resolution`, '必须显式提供 resolution，未发生身份修正时使用 null');
      edges.set(entityId, []);
      continue;
    }
    if (entity.resolution === null) {
      edges.set(entityId, []);
      continue;
    }
    if (!isObject(entity.resolution)) {
      report(`${location}.resolution`, '必须是对象或 null');
      edges.set(entityId, []);
      continue;
    }
    if (entity.recordState !== 'archived') {
      report(`${location}.resolution`, '有 resolution 的 Entity 必须为 archived');
    }

    const { type, targetEntityIds, reason } = entity.resolution;
    if (!RESOLUTION_TYPES.has(type)) {
      report(`${location}.resolution.type`, '只允许 duplicate、merge、split、misidentified');
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      report(`${location}.resolution.reason`, '必须说明身份修正原因');
    }

    const targets = Array.isArray(targetEntityIds) ? targetEntityIds : [];
    if (!Array.isArray(targetEntityIds) || targets.some((id) => typeof id !== 'string' || id.length === 0)) {
      report(`${location}.resolution.targetEntityIds`, '必须是非空字符串组成的数组');
    }
    if (new Set(targets).size !== targets.length) {
      report(`${location}.resolution.targetEntityIds`, '不得包含重复 target');
    }
    if (['duplicate', 'merge', 'misidentified'].includes(type) && targets.length !== 1) {
      report(`${location}.resolution.targetEntityIds`, `${type} 必须正好有一个 target`);
    }
    if (type === 'split' && targets.length < 2) {
      report(`${location}.resolution.targetEntityIds`, 'split 必须至少有两个 targets');
    }
    for (const targetId of targets) {
      if (targetId === entityId) {
        report(`${location}.resolution.targetEntityIds`, '不得包含自身');
      } else if (!entityIndex.has(targetId)) {
        report(`${location}.resolution.targetEntityIds`, `Entity 不存在：${targetId}`);
      } else {
        const target = entityIndex.get(targetId).entity;
        if (target.recordState === 'archived' && target.resolution === null) {
          report(`${location}.resolution.targetEntityIds`, `target 是无后续 resolution 的 archived Entity：${targetId}`);
        }
      }
    }
    edges.set(entityId, targets.filter((targetId) => entityIndex.has(targetId) && targetId !== entityId));
  }

  const state = new Map();
  const stack = [];
  const reportedCycles = new Set();

  function visit(entityId) {
    state.set(entityId, 1);
    stack.push(entityId);
    for (const targetId of edges.get(entityId) ?? []) {
      if ((state.get(targetId) ?? 0) === 0) {
        visit(targetId);
      } else if (state.get(targetId) === 1) {
        const cycleStart = stack.indexOf(targetId);
        const cycle = [...stack.slice(cycleStart), targetId];
        const cycleKey = [...new Set(cycle)].sort().join('|');
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          report('entity-resolution', `resolution 链形成循环：${cycle.join(' -> ')}`);
        }
      }
    }
    stack.pop();
    state.set(entityId, 2);
  }

  for (const entityId of entityIndex.keys()) {
    if ((state.get(entityId) ?? 0) === 0) visit(entityId);
  }
}

function validatePublicationMetadata(entity, location, report) {
  if (!Object.hasOwn(entity, 'publishedAt')) {
    report(`${location}.publishedAt`, '必须显式提供 publishedAt，未发布时使用 null');
    return;
  }
  if (entity.recordState === 'published' && entity.publishedAt === null) {
    report(`${location}.publishedAt`, 'published 状态必须有首次生产发布日期');
    return;
  }
  if (entity.publishedAt !== null && !isValidDate(entity.publishedAt)) {
    report(`${location}.publishedAt`, '必须是合法的 YYYY-MM-DD 日期或 null');
    return;
  }
  if (isValidDate(entity.publishedAt) && isValidDate(entity.updatedAt) &&
      entity.publishedAt > entity.updatedAt) {
    report(`${location}.publishedAt`, '不得晚于 updatedAt');
  }
}

async function runFixtureFile(fixtureFile) {
  let fixtureDocument;
  try {
    fixtureDocument = JSON.parse(await fs.readFile(fixtureFile, 'utf8'));
  } catch (cause) {
    console.error(`${path.relative(ROOT_DIR, fixtureFile)} 无法解析：${cause.message}`);
    return false;
  }
  if (!isObject(fixtureDocument) || typeof fixtureDocument.fixtureNotice !== 'string' ||
      !fixtureDocument.fixtureNotice.includes('测试数据') || !Array.isArray(fixtureDocument.cases)) {
    console.error('Fixture 文件必须明确标记为测试数据，并包含 cases 数组。');
    return false;
  }

  let allMatched = true;
  for (const fixtureCase of fixtureDocument.cases) {
    const caseErrors = [];
    const report = (location, message) => caseErrors.push(`${location}: ${message}`);
    const fixtureSources = new Map(
      (Array.isArray(fixtureCase.sources) ? fixtureCase.sources : []).map((source) => [source.id, source])
    );
    const fixtureEntities = new Map();
    const fixtureSlugs = new Map();
    for (const [index, entity] of (Array.isArray(fixtureCase.entities) ? fixtureCase.entities : []).entries()) {
      const location = `${fixtureCase.name}.entities[${index}]`;
      if (!isObject(entity)) {
        report(location, 'Entity 必须是对象');
        continue;
      }
      if (fixtureEntities.has(entity.id)) {
        report(`${location}.id`, `id 与 ${fixtureEntities.get(entity.id).location}.id 重复：${entity.id}`);
      } else {
        fixtureEntities.set(entity.id, { location, entity });
      }
      if (ENTITY_TYPES.has(entity.entityType)) {
        if (typeof entity.slug !== 'string' || !SLUG_PATTERN.test(entity.slug)) {
          report(`${location}.slug`, '必须是 ASCII kebab-case');
        } else if (fixtureSlugs.has(entity.slug)) {
          report(`${location}.slug`, `与 ${fixtureSlugs.get(entity.slug)} 重复`);
        } else {
          fixtureSlugs.set(entity.slug, location);
        }
      }
    }

    for (const { location, entity } of fixtureEntities.values()) {
      if (Object.hasOwn(entity, 'publishedAt') || Object.hasOwn(entity, 'updatedAt') ||
          entity.recordState === 'published') {
        validatePublicationMetadata(entity, location, report);
      }
      for (const [factIndex, fact] of (Array.isArray(entity.facts) ? entity.facts : []).entries()) {
        validateOfficialSourceRule(fact, fixtureSources, `${location}.facts[${factIndex}]`, report);
        validateReferences(fact.sourceIds, `${location}.facts[${factIndex}].sourceIds`, fixtureSources, 'Source', report);
        if (fact.status === 'release-verified') {
          report(`${location}.facts[${factIndex}].status`, '当前发售前阶段禁止 release-verified');
        }
      }
      if (entity.entityType === 'boss') {
        const ownedFacts = new Set((Array.isArray(entity.facts) ? entity.facts : []).map((fact) => fact.id));
        const bossFactKeys = new Set(['boss.exists', 'boss.name', 'boss.kind', 'boss.publicAppearance']);
        validateStringArray(entity.summaryFactIds, `${location}.summaryFactIds`);
        for (const factId of entity.summaryFactIds ?? []) {
          if (!ownedFacts.has(factId)) report(`${location}.summaryFactIds`, `Fact 不属于当前 Boss：${factId}`);
        }
        for (const [factIndex, fact] of (Array.isArray(entity.facts) ? entity.facts : []).entries()) {
          if (!bossFactKeys.has(fact.key)) report(`${location}.facts[${factIndex}].key`, `Boss Fact key 未注册：${fact.key}`);
        }
      }
      if (entity.entityType === 'character') {
        const ownedFacts = new Set((Array.isArray(entity.facts) ? entity.facts : []).map((fact) => fact.id));
        validateStringArray(entity.summaryFactIds, `${location}.summaryFactIds`);
        for (const factId of entity.summaryFactIds ?? []) {
          if (!ownedFacts.has(factId)) report(`${location}.summaryFactIds`, `Fact 不属于当前 Character：${factId}`);
        }
      }
      if (entity.entityType === 'location') {
        const ownedFacts = new Set((Array.isArray(entity.facts) ? entity.facts : []).map((fact) => fact.id));
        const locationFactKeys = new Set([
          'location.exists',
          'location.name',
          'location.kind',
          'location.publicAppearance',
          'location.observedTrait'
        ]);
        validateStringArray(entity.summaryFactIds, `${location}.summaryFactIds`);
        for (const factId of entity.summaryFactIds ?? []) {
          if (!ownedFacts.has(factId)) report(`${location}.summaryFactIds`, `Fact 不属于当前 Location：${factId}`);
        }
        for (const [factIndex, fact] of (Array.isArray(entity.facts) ? entity.facts : []).entries()) {
          if (!locationFactKeys.has(fact.key)) report(`${location}.facts[${factIndex}].key`, `Location Fact key 未注册：${fact.key}`);
        }
      }
    }
    validateEntityResolutions(fixtureEntities, report);

    const fixtureVersions = new Map(
      (Array.isArray(fixtureCase.versions) ? fixtureCase.versions : [{ id: 'version:fixture' }])
        .map((version) => [version.id, version])
    );
    const fixtureRelations = new Map();
    const fixtureRelationTuples = new Map();
    for (const [index, relation] of (Array.isArray(fixtureCase.relations) ? fixtureCase.relations : []).entries()) {
      const location = `${fixtureCase.name}.relations[${index}]`;
      if (!isObject(relation)) {
        report(location, 'Relation 顶层必须是对象');
        continue;
      }
      if (fixtureRelations.has(relation.id)) {
        report(`${location}.id`, `id 与 ${fixtureRelations.get(relation.id).location}.id 重复：${relation.id}`);
      } else {
        fixtureRelations.set(relation.id, { location, relation });
      }
      validateRelation(relation, location, fixtureEntities, fixtureSources, fixtureVersions, report, { checkScope: false });
      const tuple = `${relation.sourceEntityId}|${relation.relationType}|${relation.targetEntityId}`;
      if (fixtureRelationTuples.has(tuple)) {
        report(location, `Relation 与 ${fixtureRelationTuples.get(tuple)} 重复`);
      } else {
        fixtureRelationTuples.set(tuple, location);
      }
    }

    const actual = caseErrors.length === 0 ? 'pass' : 'fail';
    const expectedErrorPresent = fixtureCase.expectedErrorIncludes === undefined ||
      caseErrors.some((item) => item.includes(fixtureCase.expectedErrorIncludes));
    const matched = actual === fixtureCase.expected && expectedErrorPresent;
    allMatched &&= matched;
    console.log(`${matched ? 'PASS' : 'FAIL'} ${fixtureCase.name}: expected ${fixtureCase.expected}, got ${actual}`);
    if (!matched || fixtureCase.expected === 'fail') {
      for (const item of caseErrors) console.log(`  - ${item}`);
    }
  }
  console.log(`${path.relative(ROOT_DIR, fixtureFile).replaceAll('\\', '/')}: ${fixtureDocument.cases.length} fixture cases`);
  return allMatched;
}

async function runFixtures() {
  const results = await Promise.all([
    runFixtureFile(FIXTURE_FILE),
    runFixtureFile(CHARACTER_FIXTURE_FILE),
    runFixtureFile(BOSS_FIXTURE_FILE),
    runFixtureFile(LOCATION_FIXTURE_FILE),
    runFixtureFile(RELATION_FIXTURE_FILE)
  ]);
  return results.every(Boolean);
}

if (FIXTURE_MODE) {
  const fixturesPassed = await runFixtures();
  process.exit(fixturesPassed ? 0 : 1);
}

const [sourceFiles, versionFiles, weaponFiles, characterFiles, bossFiles, locationFiles, relationFiles, factRegistryFile, platformRegistryFile] = await Promise.all([
  readRecordDirectory('sources'),
  readRecordDirectory('versions'),
  readRecordDirectory('weapons'),
  readRecordDirectory('characters'),
  readRecordDirectory('bosses'),
  readRecordDirectory('locations'),
  readRecordDirectory('relations'),
  readJson(path.join(DATA_DIR, 'registries', 'fact-keys.json')),
  readJson(path.join(DATA_DIR, 'registries', 'platforms.json'))
]);

const sources = new Map();
for (const { relative, value: source } of sourceFiles) {
  if (!isObject(source)) {
    error(relative, 'Source 顶层必须是对象');
    continue;
  }
  validateSchemaVersion(source, relative);
  registerId(source.id, `${relative}.id`);
  if (typeof source.id === 'string') sources.set(source.id, source);
  if (typeof source.sourceType !== 'string' || source.sourceType.length === 0) {
    error(`${relative}.sourceType`, '必须是非空字符串');
  }
  if (!AUTHORITY_VALUES.has(source.authority)) {
    error(`${relative}.authority`, 'authority 不在允许值中');
  }
  for (const field of ['publisher', 'title', 'language']) {
    if (typeof source[field] !== 'string' || source[field].length === 0) {
      error(`${relative}.${field}`, '必须是非空字符串');
    }
  }
  validateUrl(source.url, `${relative}.url`);
  validateDate(source.publishedAt, `${relative}.publishedAt`, { nullable: true });
  validateDate(source.checkedAt, `${relative}.checkedAt`);
  validateUrl(source.archivedUrl, `${relative}.archivedUrl`, { nullable: true });
  if (source.notes !== null && typeof source.notes !== 'string') {
    error(`${relative}.notes`, '必须是字符串或 null');
  }
}

const factRegistry = new Map();
if (!isObject(factRegistryFile.value)) {
  error(factRegistryFile.relative, 'Fact key Registry 顶层必须是对象');
} else {
  validateSchemaVersion(factRegistryFile.value, factRegistryFile.relative);
  const entries = factRegistryFile.value.factKeys;
  if (!Array.isArray(entries)) {
    error(`${factRegistryFile.relative}.factKeys`, '必须是数组');
  } else {
    for (const [index, entry] of entries.entries()) {
      const location = `${factRegistryFile.relative}.factKeys[${index}]`;
      if (!isObject(entry) || typeof entry.key !== 'string' || entry.key.length === 0) {
        error(location, '必须包含非空 key');
        continue;
      }
      if (factRegistry.has(entry.key)) error(`${location}.key`, `Fact key 重复：${entry.key}`);
      factRegistry.set(entry.key, entry);
      validateStringArray(entry.applicableEntityTypes, `${location}.applicableEntityTypes`);
      validateStringArray(entry.allowedValueTypes, `${location}.allowedValueTypes`);
      if (typeof entry.description !== 'string' || entry.description.length === 0) {
        error(`${location}.description`, '必须是非空字符串');
      }
      if (typeof entry.requiresAsOf !== 'boolean') {
        error(`${location}.requiresAsOf`, '必须是布尔值');
      }
      if (entry.enumValues !== undefined) validateStringArray(entry.enumValues, `${location}.enumValues`);
    }
  }
}

const platforms = new Set();
if (!isObject(platformRegistryFile.value)) {
  error(platformRegistryFile.relative, 'Platform Registry 顶层必须是对象');
} else {
  validateSchemaVersion(platformRegistryFile.value, platformRegistryFile.relative);
  const entries = platformRegistryFile.value.platforms;
  if (!Array.isArray(entries)) {
    error(`${platformRegistryFile.relative}.platforms`, '必须是数组');
  } else {
    for (const [index, platform] of entries.entries()) {
      const location = `${platformRegistryFile.relative}.platforms[${index}]`;
      if (!isObject(platform)) {
        error(location, '必须是对象');
        continue;
      }
      registerId(platform.id, `${location}.id`);
      if (platforms.has(platform.id)) error(`${location}.id`, `平台 id 重复：${platform.id}`);
      if (typeof platform.id === 'string') platforms.add(platform.id);
      if (typeof platform.displayName !== 'string' || platform.displayName.length === 0) {
        error(`${location}.displayName`, '必须是非空字符串');
      }
    }
  }
}

const versions = new Map();
for (const { relative, value: version } of versionFiles) {
  if (!isObject(version)) {
    error(relative, 'GameVersion 顶层必须是对象');
    continue;
  }
  validateSchemaVersion(version, relative);
  registerId(version.id, `${relative}.id`);
  if (typeof version.id === 'string') versions.set(version.id, version);
  if (!VERSION_STAGES.has(version.stage)) error(`${relative}.stage`, '当前试点不支持该 stage');
  if (typeof version.displayName !== 'string' || version.displayName.length === 0) {
    error(`${relative}.displayName`, '必须是非空字符串');
  }
  if (version.versionLabel !== null && typeof version.versionLabel !== 'string') {
    error(`${relative}.versionLabel`, '必须是字符串或 null');
  }
  if (version.track !== 'prelaunch') error(`${relative}.track`, '当前试点必须为 prelaunch');
  if (!Number.isInteger(version.sequence)) error(`${relative}.sequence`, '必须是整数');
  if (validateStringArray(version.platformIds, `${relative}.platformIds`)) {
    for (const platformId of version.platformIds) {
      if (!platforms.has(platformId)) error(`${relative}.platformIds`, `平台不存在：${platformId}`);
    }
  }
  validateDate(version.releasedAt, `${relative}.releasedAt`, { nullable: true });
  validateDate(version.checkedAt, `${relative}.checkedAt`);
  validateStringArray(version.sourceIds, `${relative}.sourceIds`);
}

const entities = new Map();
const facts = new Map();
const factOwners = new Map();
const entitySlugs = new Map([...ENTITY_TYPES].map((entityType) => [entityType, new Map()]));

for (const { relative, value: entity } of [...weaponFiles, ...characterFiles, ...bossFiles, ...locationFiles]) {
  if (!isObject(entity)) {
    error(relative, 'Entity 顶层必须是对象');
    continue;
  }
  validateSchemaVersion(entity, relative);
  registerId(entity.id, `${relative}.id`);
  if (typeof entity.id === 'string') entities.set(entity.id, { relative, entity });
  if (!ENTITY_TYPES.has(entity.entityType)) {
    error(`${relative}.entityType`, 'entityType 必须为 weapon、character、boss 或 location');
  }
  if (typeof entity.slug !== 'string' || !SLUG_PATTERN.test(entity.slug)) {
    error(`${relative}.slug`, '必须是 ASCII kebab-case');
  } else if (ENTITY_TYPES.has(entity.entityType)) {
    const slugs = entitySlugs.get(entity.entityType);
    if (slugs.has(entity.slug)) {
      error(`${relative}.slug`, `与 ${slugs.get(entity.slug)} 重复`);
    } else {
      slugs.set(entity.slug, relative);
    }
  }
  for (const field of ['displayName', 'summary']) {
    if (typeof entity[field] !== 'string' || entity[field].length === 0) {
      error(`${relative}.${field}`, '必须是非空字符串');
    }
  }
  if (!Array.isArray(entity.aliases)) error(`${relative}.aliases`, '必须是数组');
  validateStringArray(entity.summaryFactIds, `${relative}.summaryFactIds`);
  validateStringArray(entity.taxonomyIds, `${relative}.taxonomyIds`);
  validatePublicationMetadata(entity, relative, error);
  validateDate(entity.updatedAt, `${relative}.updatedAt`);
  if (!Array.isArray(entity.facts)) {
    error(`${relative}.facts`, '必须是数组');
    continue;
  }
  for (const [index, fact] of entity.facts.entries()) {
    const location = `${relative}.facts[${index}]`;
    if (!isObject(fact)) {
      error(location, 'Fact 必须是对象');
      continue;
    }
    registerId(fact.id, `${location}.id`);
    if (typeof fact.id === 'string') {
      facts.set(fact.id, { relative: location, fact });
      factOwners.set(fact.id, entity.id);
    }
  }
}

validateEntityResolutions(
  new Map([...entities].map(([id, { relative, entity }]) => [id, { location: relative, entity }])),
  error
);

const relations = new Map();
const relationTuples = new Map();
for (const { relative, value: relation } of relationFiles) {
  if (!isObject(relation)) {
    error(relative, 'Relation 顶层必须是对象');
    continue;
  }
  registerId(relation.id, `${relative}.id`);
  if (typeof relation.id === 'string') relations.set(relation.id, { relative, relation });
  validateRelation(relation, relative, entities, sources, versions, error);
  const tuple = `${relation.sourceEntityId}|${relation.relationType}|${relation.targetEntityId}`;
  if (relationTuples.has(tuple)) {
    error(relative, `Relation 与 ${relationTuples.get(tuple)} 重复`);
  } else {
    relationTuples.set(tuple, relative);
  }
}

function validateReferences(ids, location, index, label, report = error) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    report(location, '必须是非空字符串组成的数组（数组本身可以为空）');
    return;
  }
  for (const id of ids) {
    if (!index.has(id)) report(location, `${label} 不存在：${id}`);
  }
}

function validateScope(scope, location) {
  if (!isObject(scope)) {
    error(location, 'scope 必须是对象');
    return;
  }
  for (const dimension of ['platforms', 'difficulties']) {
    const entry = scope[dimension];
    const entryLocation = `${location}.${dimension}`;
    if (!isObject(entry) || !['all', 'include'].includes(entry.mode)) {
      error(entryLocation, '必须包含 mode=all 或 mode=include');
      continue;
    }
    if (!validateStringArray(entry.ids, `${entryLocation}.ids`)) continue;
    if (entry.mode === 'all' && entry.ids.length > 0) {
      error(`${entryLocation}.ids`, 'mode=all 时必须为空');
    }
    if (entry.mode === 'include' && entry.ids.length === 0) {
      error(`${entryLocation}.ids`, 'mode=include 时不能为空');
    }
    if (dimension === 'platforms') {
      for (const platformId of entry.ids) {
        if (!platforms.has(platformId)) error(`${entryLocation}.ids`, `平台不存在：${platformId}`);
      }
    } else if (entry.mode === 'include') {
      error(entryLocation, '当前试点未建立 difficulty Registry，不能使用难度限定');
    }
  }
}

function validateRelation(relation, location, entityIndex, sourceIndex, versionIndex, report, { checkScope = true } = {}) {
  if (!isObject(relation)) {
    report(location, 'Relation 顶层必须是对象');
    return;
  }
  validateSchemaVersion(relation, location);
  for (const field of ['sourceEntityId', 'targetEntityId', 'relationType', 'status', 'checkedAt', 'gameVersionId']) {
    if (typeof relation[field] !== 'string' || relation[field].length === 0) {
      report(`${location}.${field}`, '必须是非空字符串');
    }
  }
  if (!entityIndex.has(relation.sourceEntityId)) {
    report(`${location}.sourceEntityId`, `Entity 不存在：${relation.sourceEntityId}`);
  }
  if (!entityIndex.has(relation.targetEntityId)) {
    report(`${location}.targetEntityId`, `Entity 不存在：${relation.targetEntityId}`);
  }
  if (relation.sourceEntityId === relation.targetEntityId) {
    report(location, 'Relation 不得指向自身');
  }
  if (!RELATION_TYPES.has(relation.relationType)) {
    report(`${location}.relationType`, `不支持 relationType：${relation.relationType}`);
  }
  for (const [field, entityId] of [['sourceEntityId', relation.sourceEntityId], ['targetEntityId', relation.targetEntityId]]) {
    const entityType = entityIndex.get(entityId)?.entity.entityType ?? entityId?.split(':')[0];
    if (entityIndex.has(entityId) && entityType !== 'character') {
      report(`${location}.${field}`, `${relation.relationType} 仅适用于 Character Entity`);
    }
  }
  if (!STATUS_VALUES.has(relation.status)) report(`${location}.status`, 'status 不合法');
  if (relation.status === 'release-verified') report(`${location}.status`, '当前发售前阶段禁止 release-verified');
  validateReferences(relation.sourceIds, `${location}.sourceIds`, sourceIndex, 'Source', report);
  validateDate(relation.checkedAt, `${location}.checkedAt`);
  if (!versionIndex.has(relation.gameVersionId)) {
    report(`${location}.gameVersionId`, `GameVersion 不存在：${relation.gameVersionId}`);
  }
  if (checkScope) validateScope(relation.scope, `${location}.scope`);
  for (const field of ['validFromVersionId', 'validToVersionId']) {
    const target = relation[field];
    if (target !== null && !versionIndex.has(target)) {
      report(`${location}.${field}`, `GameVersion 不存在：${target}`);
    }
  }
  const sourceIds = Array.isArray(relation.sourceIds) ? relation.sourceIds : [];
  validateOfficialSourceRule(relation, sourceIndex, location, report, 'Relation');
  if (relation.status === 'observation' && sourceIds.length === 0) {
    report(`${location}.sourceIds`, 'observation Relation 必须有 Source');
  }
  if (relation.status === 'third-party' && !sourceIds.some((id) => sourceIndex.get(id)?.authority === 'third-party')) {
    report(`${location}.sourceIds`, 'third-party Relation 至少需要一个 authority=third-party Source');
  }
  if (relation.status === 'pending-review' && (typeof relation.reviewNote !== 'string' || relation.reviewNote.length === 0)) {
    report(`${location}.reviewNote`, 'pending-review Relation 必须说明待核查原因');
  }
}

function validateFactValue(fact, registryEntry, location) {
  if (fact.value === null) {
    if (fact.status !== 'pending-review') error(`${location}.value`, '只有 pending-review Fact 可以使用 null');
    return;
  }
  if (fact.valueType === 'string' && typeof fact.value !== 'string') {
    error(`${location}.value`, 'valueType=string 时 value 必须是字符串');
  } else if (fact.valueType === 'boolean' && typeof fact.value !== 'boolean') {
    error(`${location}.value`, 'valueType=boolean 时 value 必须是布尔值');
  } else if (fact.valueType === 'enum') {
    if (typeof fact.value !== 'string' || !registryEntry.enumValues?.includes(fact.value)) {
      error(`${location}.value`, 'enum value 不在 Registry 允许值中');
    }
  } else if (fact.valueType === 'rating') {
    const rating = fact.value;
    if (!isObject(rating) || typeof rating.score !== 'number' || typeof rating.max !== 'number' ||
        rating.max <= 0 || rating.score < 0 || rating.score > rating.max) {
      error(`${location}.value`, 'rating 必须包含合法的 score 和 max');
    }
  }
}

for (const [versionId, version] of versions) {
  const location = idOwners.get(versionId)?.replace(/\.id$/, '') ?? versionId;
  validateReferences(version.sourceIds, `${location}.sourceIds`, sources, 'Source');
  for (const field of ['supersedesVersionId', 'supersededBy']) {
    const target = version[field];
    if (target !== null && !versions.has(target)) error(`${location}.${field}`, `GameVersion 不存在：${target}`);
    if (target === versionId) error(`${location}.${field}`, '不能指向自身');
  }
}

for (const [entityId, { relative, entity }] of entities) {
  for (const [index, alias] of (Array.isArray(entity.aliases) ? entity.aliases : []).entries()) {
    const location = `${relative}.aliases[${index}]`;
    if (!isObject(alias)) {
      error(location, 'Alias 必须是对象');
      continue;
    }
    for (const field of ['value', 'locale', 'kind']) {
      if (typeof alias[field] !== 'string' || alias[field].length === 0) error(`${location}.${field}`, '必须是非空字符串');
    }
    if (!STATUS_VALUES.has(alias.status)) error(`${location}.status`, 'status 不合法');
    if (alias.status === 'release-verified') error(`${location}.status`, '发售前禁止 release-verified');
    if (alias.status === 'pending-review' && (typeof alias.reviewNote !== 'string' || alias.reviewNote.length === 0)) {
      error(`${location}.reviewNote`, 'pending-review Alias 必须说明待核查原因');
    }
    validateReferences(alias.sourceIds, `${location}.sourceIds`, sources, 'Source');
    validateDate(alias.checkedAt, `${location}.checkedAt`);
    if (!versions.has(alias.gameVersionId)) error(`${location}.gameVersionId`, `GameVersion 不存在：${alias.gameVersionId}`);
  }
  validateReferences(entity.summaryFactIds, `${relative}.summaryFactIds`, facts, 'Fact');
  for (const factId of entity.summaryFactIds ?? []) {
    if (facts.has(factId) && factOwners.get(factId) !== entityId) {
      error(`${relative}.summaryFactIds`, `Summary 不能引用其他 Entity 的 Fact：${factId}`);
    }
  }
}

for (const [factId, { relative: location, fact }] of facts) {
  const sourceIds = Array.isArray(fact.sourceIds) ? fact.sourceIds : [];
  const basisFactIds = Array.isArray(fact.basisFactIds) ? fact.basisFactIds : [];
  if (!STATUS_VALUES.has(fact.status)) error(`${location}.status`, 'status 不合法');
  if (fact.status === 'release-verified') error(`${location}.status`, '当前发售前阶段禁止 release-verified');
  if ('authority' in fact || 'publisherKind' in fact || 'isOfficial' in fact) {
    error(location, 'Fact 不得复制 Source authority 或使用 isOfficial；可信度只能由 status 表达');
  }
  const registryEntry = factRegistry.get(fact.key);
  if (!registryEntry) {
    error(`${location}.key`, `Fact key 未注册：${fact.key}`);
  } else {
    const ownerType = entities.get(factOwners.get(factId))?.entity.entityType;
    if (!registryEntry.applicableEntityTypes.includes(ownerType)) {
      error(`${location}.key`, `Fact key 不适用于 ${ownerType}`);
    }
    if (!registryEntry.allowedValueTypes.includes(fact.valueType)) {
      error(`${location}.valueType`, `${fact.valueType} 不符合 Registry`);
    }
    validateFactValue(fact, registryEntry, location);
    if (registryEntry.requiresAsOf && !isValidDate(fact.asOf)) {
      error(`${location}.asOf`, '动态 Fact 必须有合法 asOf');
    }
  }
  validateReferences(fact.sourceIds, `${location}.sourceIds`, sources, 'Source');
  validateReferences(fact.basisFactIds, `${location}.basisFactIds`, facts, 'basis Fact');
  validateDate(fact.checkedAt, `${location}.checkedAt`);
  if (!versions.has(fact.gameVersionId)) error(`${location}.gameVersionId`, `GameVersion 不存在：${fact.gameVersionId}`);
  validateScope(fact.scope, `${location}.scope`);
  if (fact.asOf !== undefined && fact.asOf !== null) {
    validateDate(fact.asOf, `${location}.asOf`);
    if (isValidDate(fact.asOf) && isValidDate(fact.checkedAt) && fact.asOf > fact.checkedAt) {
      error(`${location}.asOf`, '不得晚于 checkedAt');
    }
  }
  if (fact.status === 'pending-review' && (typeof fact.reviewNote !== 'string' || fact.reviewNote.length === 0)) {
    error(`${location}.reviewNote`, 'pending-review 必须说明待核查原因');
  }
  validateOfficialSourceRule(fact, sources, location, error);
  if (fact.status === 'observation' && sourceIds.length === 0) {
    error(`${location}.sourceIds`, 'observation Fact 必须有 Source');
  }
  if (fact.status === 'third-party' && !sourceIds.some((id) => sources.get(id)?.authority === 'third-party')) {
    error(`${location}.sourceIds`, 'third-party Fact 至少需要一个 authority=third-party Source');
  }
  if (fact.status === 'editorial' && basisFactIds.length === 0 &&
      !sourceIds.some((id) => sources.get(id)?.authority === 'internal')) {
    error(location, 'editorial Fact 必须有 basisFactIds；只有独立 internal Source 可作为无 basis 的例外');
  }
  for (const field of ['validFromVersionId', 'validToVersionId']) {
    const target = fact[field];
    if (target !== null && !versions.has(target)) error(`${location}.${field}`, `GameVersion 不存在：${target}`);
  }
  if (fact.validFromVersionId && fact.validToVersionId) {
    const from = versions.get(fact.validFromVersionId)?.sequence;
    const to = versions.get(fact.validToVersionId)?.sequence;
    if (Number.isInteger(from) && Number.isInteger(to) && from > to) {
      error(location, 'validFromVersionId 不得晚于 validToVersionId');
    }
  }
  if (fact.supersededBy !== null && !facts.has(fact.supersededBy)) {
    error(`${location}.supersededBy`, `Fact 不存在：${fact.supersededBy}`);
  }
  if (fact.supersededBy === factId) error(`${location}.supersededBy`, '不能指向自身');
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} error(s):`);
  for (const item of errors) console.error(`- ${item}`);
  process.exitCode = 1;
} else {
  console.log('Data validation passed.');
  console.log(`Sources: ${sources.size}`);
  console.log(`GameVersions: ${versions.size}`);
  console.log(`Weapons: ${[...entities.values()].filter(({ entity }) => entity.entityType === 'weapon').length}`);
  console.log(`Characters: ${[...entities.values()].filter(({ entity }) => entity.entityType === 'character').length}`);
  console.log(`Bosses: ${[...entities.values()].filter(({ entity }) => entity.entityType === 'boss').length}`);
  console.log(`Locations: ${[...entities.values()].filter(({ entity }) => entity.entityType === 'location').length}`);
  console.log(`Relations: ${relations.size}`);
  console.log(`Facts: ${facts.size}`);
  console.log(`Fact keys: ${factRegistry.size}`);
  console.log(`Platforms: ${platforms.size}`);
}

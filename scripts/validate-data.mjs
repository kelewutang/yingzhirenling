import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'knowledge-schema-cases.json');
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
const ENTITY_TYPES = new Set(['weapon']);
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

function validateOfficialSourceRule(fact, sourceIndex, location, report) {
  const sourceIds = Array.isArray(fact.sourceIds) ? fact.sourceIds : [];
  if (fact.status === 'official' && !sourceIds.some((id) => sourceIndex.get(id)?.authority === 'official')) {
    report(`${location}.sourceIds`, 'official Fact 至少需要一个 authority=official Source');
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

async function runFixtures() {
  let fixtureDocument;
  try {
    fixtureDocument = JSON.parse(await fs.readFile(FIXTURE_FILE, 'utf8'));
  } catch (cause) {
    console.error(`Fixture JSON 无法解析：${cause.message}`);
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
    const fixtureEntities = new Map(
      (Array.isArray(fixtureCase.entities) ? fixtureCase.entities : []).map((entity, index) => [
        entity.id,
        { location: `${fixtureCase.name}.entities[${index}]`, entity }
      ])
    );

    for (const { location, entity } of fixtureEntities.values()) {
      for (const [factIndex, fact] of (Array.isArray(entity.facts) ? entity.facts : []).entries()) {
        validateOfficialSourceRule(fact, fixtureSources, `${location}.facts[${factIndex}]`, report);
      }
    }
    validateEntityResolutions(fixtureEntities, report);

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
  console.log(`Fixture cases: ${fixtureDocument.cases.length}`);
  return allMatched;
}

if (FIXTURE_MODE) {
  const fixturesPassed = await runFixtures();
  process.exit(fixturesPassed ? 0 : 1);
}

const [sourceFiles, versionFiles, weaponFiles, factRegistryFile, platformRegistryFile] = await Promise.all([
  readRecordDirectory('sources'),
  readRecordDirectory('versions'),
  readRecordDirectory('weapons'),
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

const weapons = new Map();
const facts = new Map();
const factOwners = new Map();
const weaponSlugs = new Map();

for (const { relative, value: weapon } of weaponFiles) {
  if (!isObject(weapon)) {
    error(relative, 'Weapon 顶层必须是对象');
    continue;
  }
  validateSchemaVersion(weapon, relative);
  registerId(weapon.id, `${relative}.id`);
  if (typeof weapon.id === 'string') weapons.set(weapon.id, { relative, weapon });
  if (!ENTITY_TYPES.has(weapon.entityType)) error(`${relative}.entityType`, 'entityType 必须为 weapon');
  if (typeof weapon.slug !== 'string' || !SLUG_PATTERN.test(weapon.slug)) {
    error(`${relative}.slug`, '必须是 ASCII kebab-case');
  } else if (weaponSlugs.has(weapon.slug)) {
    error(`${relative}.slug`, `与 ${weaponSlugs.get(weapon.slug)} 重复`);
  } else {
    weaponSlugs.set(weapon.slug, relative);
  }
  for (const field of ['displayName', 'summary']) {
    if (typeof weapon[field] !== 'string' || weapon[field].length === 0) {
      error(`${relative}.${field}`, '必须是非空字符串');
    }
  }
  if (!Array.isArray(weapon.aliases)) error(`${relative}.aliases`, '必须是数组');
  validateStringArray(weapon.summaryFactIds, `${relative}.summaryFactIds`);
  validateStringArray(weapon.taxonomyIds, `${relative}.taxonomyIds`);
  validateDate(weapon.publishedAt, `${relative}.publishedAt`, { nullable: true });
  validateDate(weapon.updatedAt, `${relative}.updatedAt`);
  if (!Array.isArray(weapon.facts)) {
    error(`${relative}.facts`, '必须是数组');
    continue;
  }
  for (const [index, fact] of weapon.facts.entries()) {
    const location = `${relative}.facts[${index}]`;
    if (!isObject(fact)) {
      error(location, 'Fact 必须是对象');
      continue;
    }
    registerId(fact.id, `${location}.id`);
    if (typeof fact.id === 'string') {
      facts.set(fact.id, { relative: location, fact });
      factOwners.set(fact.id, weapon.id);
    }
  }
}

validateEntityResolutions(
  new Map([...weapons].map(([id, { relative, weapon }]) => [id, { location: relative, entity: weapon }])),
  error
);

function validateReferences(ids, location, index, label) {
  if (!validateStringArray(ids, location)) return;
  for (const id of ids) {
    if (!index.has(id)) error(location, `${label} 不存在：${id}`);
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

for (const [weaponId, { relative, weapon }] of weapons) {
  for (const [index, alias] of (Array.isArray(weapon.aliases) ? weapon.aliases : []).entries()) {
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
  validateReferences(weapon.summaryFactIds, `${relative}.summaryFactIds`, facts, 'Fact');
  for (const factId of weapon.summaryFactIds ?? []) {
    if (facts.has(factId) && factOwners.get(factId) !== weaponId) {
      error(`${relative}.summaryFactIds`, `Summary 不能引用其他 Weapon 的 Fact：${factId}`);
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
    const ownerType = weapons.get(factOwners.get(factId))?.weapon.entityType;
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
  console.log(`Weapons: ${weapons.size}`);
  console.log(`Facts: ${facts.size}`);
  console.log(`Fact keys: ${factRegistry.size}`);
  console.log(`Platforms: ${platforms.size}`);
}

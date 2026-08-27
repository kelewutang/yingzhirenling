import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const WEAPONS_DIR = path.join(ROOT_DIR, 'data', 'weapons');
const VALIDATOR_FILE = path.join(SCRIPT_DIR, 'validate-data.mjs');
const OUTPUT_FILE = path.join(ROOT_DIR, 'generated', 'search-index.json');

const SCHEMA_VERSION = '1.0-implementation';
const WEAPON_ROUTE = '/weapons';
const INDEXABLE_RECORD_STATES = new Set(['draft', 'published']);
const SKIPPED_RECORD_STATES = new Set(['archived']);
const SEARCHABLE_ALIAS_KINDS = new Set([
  'official-zh',
  'official-en',
  'transliteration',
  'community',
  'community-temporary',
  'legacy-title',
  'search-only',
  'descriptive'
]);
const DISPLAY_ALIAS_KINDS = new Set([
  'official-zh',
  'official-en',
  'transliteration',
  'community',
  'legacy-title',
  'descriptive'
]);
const DISPLAY_ALIAS_STATUSES = new Set(['official', 'observation']);
const SEARCHABLE_FACT_STATUSES = new Set([
  'official',
  'observation',
  'third-party'
]);
const APPEARANCE_KEYWORDS = new Map([
  ['demo', ['demo', '试玩']],
  ['trailer', ['trailer', '预告片']],
  ['promotional-material', ['宣传材料']],
  ['state-of-play', ['State of Play']]
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSortedStrings(values) {
  const unique = new Map();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.normalize('NFKC').toLocaleLowerCase('en-US');
    if (!unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()].sort(compareText);
}

function runSchemaValidator() {
  const result = spawnSync(process.execPath, [VALIDATOR_FILE], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`知识库校验未通过，退出码：${result.status ?? 'unknown'}`);
  }
}

async function readWeaponRecords() {
  const entries = await fs.readdir(WEAPONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort(compareText);

  return Promise.all(files.map(async (name) => {
    const file = path.join(WEAPONS_DIR, name);
    const raw = await fs.readFile(file, 'utf8');
    return { file: path.posix.join('data/weapons', name), weapon: JSON.parse(raw) };
  }));
}

function requireSearchShape(weapon, file) {
  if (weapon.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`${file}: schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  if (weapon.entityType !== 'weapon') {
    throw new Error(`${file}: entityType 必须为 weapon`);
  }
  for (const field of ['id', 'slug', 'displayName', 'summary', 'recordState']) {
    if (typeof weapon[field] !== 'string' || weapon[field].trim().length === 0) {
      throw new Error(`${file}: ${field} 必须是非空字符串`);
    }
  }
  if (!Array.isArray(weapon.aliases) || !Array.isArray(weapon.facts) ||
      !Array.isArray(weapon.summaryFactIds)) {
    throw new Error(`${file}: aliases、facts、summaryFactIds 必须是数组`);
  }
  if (weapon.summaryFactIds.length === 0) {
    throw new Error(`${file}: summary 必须至少有一个 summaryFactId 支持`);
  }
  if (!INDEXABLE_RECORD_STATES.has(weapon.recordState) && !SKIPPED_RECORD_STATES.has(weapon.recordState)) {
    throw new Error(`${file}: 不支持 recordState=${weapon.recordState}`);
  }
}

function validateSummarySupport(weapon, file) {
  const facts = new Map(weapon.facts.map((fact) => [fact.id, fact]));
  for (const factId of weapon.summaryFactIds) {
    if (!facts.has(factId)) {
      throw new Error(`${file}: summaryFactId 不属于当前 Weapon：${factId}`);
    }
  }
}

function deriveAliases(weapon, file) {
  const searchable = [];
  const displayable = [];

  for (const alias of weapon.aliases) {
    if (!SEARCHABLE_ALIAS_KINDS.has(alias.kind)) {
      throw new Error(`${file}: Alias kind 尚无搜索策略：${alias.kind}`);
    }
    searchable.push(alias.value);
    if (DISPLAY_ALIAS_KINDS.has(alias.kind) && DISPLAY_ALIAS_STATUSES.has(alias.status)) {
      displayable.push(alias.value);
    }
  }

  return {
    aliases: uniqueSortedStrings(searchable),
    displayAliases: uniqueSortedStrings(displayable)
  };
}

function deriveKeywords(weapon) {
  const keywords = ['武器'];

  for (const fact of weapon.facts) {
    if (!SEARCHABLE_FACT_STATUSES.has(fact.status) || fact.value === null) continue;
    if (fact.key === 'weapon.kind' && typeof fact.value === 'string') {
      keywords.push(fact.value);
    }
    if (fact.key === 'weapon.publicAppearance' && typeof fact.value === 'string') {
      keywords.push(...(APPEARANCE_KEYWORDS.get(fact.value) ?? [fact.value]));
    }
  }

  return uniqueSortedStrings(keywords);
}

function buildSearchDocument(weapon, file) {
  requireSearchShape(weapon, file);
  validateSummarySupport(weapon, file);
  const { aliases, displayAliases } = deriveAliases(weapon, file);

  return {
    id: weapon.id,
    entityType: weapon.entityType,
    slug: weapon.slug,
    route: WEAPON_ROUTE,
    displayName: weapon.displayName,
    aliases,
    displayAliases,
    keywords: deriveKeywords(weapon),
    summary: weapon.summary,
    recordState: weapon.recordState,
    sourceSchemaVersion: weapon.schemaVersion
  };
}

function assertUniqueDocuments(documents) {
  for (const field of ['id', 'slug', 'displayName']) {
    const owners = new Map();
    for (const document of documents) {
      const key = document[field].normalize('NFKC').toLocaleLowerCase('en-US');
      if (owners.has(key)) {
        throw new Error(`重复 Search Document ${field}：${document[field]}（${owners.get(key)} / ${document.id}）`);
      }
      owners.set(key, document.id);
    }
  }

  for (const document of documents) {
    if (document.route !== WEAPON_ROUTE) {
      throw new Error(`${document.id}: route 必须指向当前真实路由 ${WEAPON_ROUTE}`);
    }
  }
}

async function writeDeterministicJson(documents) {
  const output = `${JSON.stringify(documents, null, 2)}\n`;
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  let previous = null;
  try {
    previous = await fs.readFile(OUTPUT_FILE, 'utf8');
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause;
  }

  if (previous === output) return false;
  await fs.writeFile(OUTPUT_FILE, output, 'utf8');
  return true;
}

async function main() {
  runSchemaValidator();
  const records = await readWeaponRecords();
  const skipped = [];
  const documents = [];

  for (const { file, weapon } of records) {
    requireSearchShape(weapon, file);
    if (SKIPPED_RECORD_STATES.has(weapon.recordState)) {
      skipped.push(weapon.id);
      continue;
    }
    documents.push(buildSearchDocument(weapon, file));
  }

  documents.sort((left, right) =>
    compareText(left.entityType, right.entityType) ||
    compareText(left.slug, right.slug) ||
    compareText(left.id, right.id));
  assertUniqueDocuments(documents);

  const changed = await writeDeterministicJson(documents);
  console.log('Search index shadow generation passed.');
  console.log(`Weapon records read: ${records.length}`);
  console.log(`Search documents written: ${documents.length}`);
  console.log(`Archived records skipped: ${skipped.length}`);
  console.log(`Shared route: ${WEAPON_ROUTE}`);
  console.log(`Output: generated/search-index.json (${changed ? 'updated' : 'unchanged'})`);
}

main().catch((cause) => {
  console.error(`Search index shadow generation failed: ${cause.message}`);
  process.exitCode = 1;
});

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const WEAPONS_DIR = path.join(ROOT_DIR, 'data', 'weapons');
const CHARACTERS_DIR = path.join(ROOT_DIR, 'data', 'characters');
const BOSSES_DIR = path.join(ROOT_DIR, 'data', 'bosses');
const WEAPON_PAGES_DIR = path.join(ROOT_DIR, 'pages', 'generated', 'weapons');
const CHARACTER_PAGES_DIR = path.join(ROOT_DIR, 'dist', 'characters');
const BOSS_PAGES_DIR = path.join(ROOT_DIR, 'dist', 'bosses');
const VALIDATOR_FILE = path.join(SCRIPT_DIR, 'validate-data.mjs');

const SCHEMA_VERSION = '1.0-implementation';
const WEAPON_ROUTE = '/weapons';
const CHARACTER_ROUTE = '/characters';
const BOSS_ROUTE = '/bosses';
const WEAPON_PAGE_MARKER = '<!-- generated-by: build-weapon-pages.mjs -->';
const SITE_ORIGIN = 'https://www.yingzhirenling.cn';
const ENTITY_ROUTES = new Map([
  ['weapon', WEAPON_ROUTE],
  ['character', CHARACTER_ROUTE],
  ['boss', BOSS_ROUTE]
]);
const ENTITY_LABELS = new Map([
  ['weapon', '武器'],
  ['character', '角色'],
  ['boss', 'Boss']
]);
const MODE_CONFIG = new Map([
  ['shadow', {
    includedStates: new Set(['draft', 'published']),
    outputFile: path.join(ROOT_DIR, 'generated', 'search-index.shadow.json')
  }],
  ['production', {
    includedStates: new Set(['published']),
    outputFile: path.join(ROOT_DIR, 'generated', 'search-index.production.json')
  }]
]);
const KNOWN_RECORD_STATES = new Set(['draft', 'published', 'archived']);
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
const SEARCHABLE_FACT_STATUSES = new Set(['official', 'observation', 'third-party']);
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

function parseOptions(args) {
  const modeArgument = args.find((argument) => argument.startsWith('--mode='));
  const detailPagesArgument = args.find((argument) => argument.startsWith('--detail-pages-dir='));
  const characterPagesArgument = args.find((argument) => argument.startsWith('--character-detail-pages-dir='));
  const bossPagesArgument = args.find((argument) => argument.startsWith('--boss-detail-pages-dir='));
  if (!modeArgument || args.some((argument) => ![modeArgument, detailPagesArgument, characterPagesArgument, bossPagesArgument].includes(argument))) {
    throw new Error('用法：node scripts/build-search-index.mjs --mode=shadow|production [--detail-pages-dir=目录] [--character-detail-pages-dir=目录] [--boss-detail-pages-dir=目录]');
  }
  const mode = modeArgument.slice('--mode='.length);
  if (!MODE_CONFIG.has(mode)) {
    throw new Error(`未知 mode：${mode || '(empty)'}；只允许 shadow 或 production`);
  }
  const detailPagesDir = detailPagesArgument
    ? path.resolve(ROOT_DIR, detailPagesArgument.slice('--detail-pages-dir='.length))
    : WEAPON_PAGES_DIR;
  const characterDetailPagesDir = characterPagesArgument
    ? path.resolve(ROOT_DIR, characterPagesArgument.slice('--character-detail-pages-dir='.length))
    : CHARACTER_PAGES_DIR;
  const bossDetailPagesDir = bossPagesArgument
    ? path.resolve(ROOT_DIR, bossPagesArgument.slice('--boss-detail-pages-dir='.length))
    : BOSS_PAGES_DIR;
  if ((detailPagesArgument || characterPagesArgument || bossPagesArgument) && mode !== 'production') {
    throw new Error('详情页目录参数只允许用于 production mode');
  }
  return { mode, detailPagesDir, characterDetailPagesDir, bossDetailPagesDir, requireLegacyMarker: !detailPagesArgument };
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

async function readEntityRecords(directory, relativeDirectory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort(compareText);

  return Promise.all(files.map(async (name) => {
    const file = path.join(directory, name);
    const raw = await fs.readFile(file, 'utf8');
    return { file: path.posix.join(relativeDirectory, name), entity: JSON.parse(raw) };
  }));
}

function requireSearchShape(entity, file) {
  if (entity.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`${file}: schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  if (!ENTITY_ROUTES.has(entity.entityType)) {
    throw new Error(`${file}: entityType 必须为 weapon、character 或 boss`);
  }
  for (const field of ['id', 'slug', 'displayName', 'summary', 'recordState']) {
    if (typeof entity[field] !== 'string' || entity[field].trim().length === 0) {
      throw new Error(`${file}: ${field} 必须是非空字符串`);
    }
  }
  if (!Array.isArray(entity.aliases) || !Array.isArray(entity.facts) ||
      !Array.isArray(entity.summaryFactIds)) {
    throw new Error(`${file}: aliases、facts、summaryFactIds 必须是数组`);
  }
  if (entity.summaryFactIds.length === 0) {
    throw new Error(`${file}: summary 必须至少有一个 summaryFactId 支持`);
  }
  if (!KNOWN_RECORD_STATES.has(entity.recordState)) {
    throw new Error(`${file}: 不支持 recordState=${entity.recordState}`);
  }
}

function validateSummarySupport(entity, file) {
  const facts = new Map(entity.facts.map((fact) => [fact.id, fact]));
  for (const factId of entity.summaryFactIds) {
    if (!facts.has(factId)) {
      throw new Error(`${file}: summaryFactId 不属于当前 Entity：${factId}`);
    }
  }
}

function deriveAliases(entity, file) {
  const searchable = [];
  const displayable = [];

  for (const alias of entity.aliases) {
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

function deriveKeywords(entity) {
  const keywords = [ENTITY_LABELS.get(entity.entityType)];

  for (const fact of entity.facts) {
    if (!SEARCHABLE_FACT_STATUSES.has(fact.status) || fact.value === null) continue;
    if ((fact.key === 'weapon.kind' || fact.key === 'character.role') && typeof fact.value === 'string') {
      keywords.push(fact.value);
    }
    if (fact.key === 'weapon.publicAppearance' && typeof fact.value === 'string') {
      keywords.push(...(APPEARANCE_KEYWORDS.get(fact.value) ?? [fact.value]));
    }
  }

  return uniqueSortedStrings(keywords);
}

function hasDetailPage(entity, detailPageSlugs) {
  if (detailPageSlugs instanceof Set) return entity.entityType === 'weapon' && detailPageSlugs.has(entity.slug);
  return detailPageSlugs.get(entity.entityType)?.has(entity.slug) ?? false;
}

function deriveEntityRoute(entity, detailPageSlugs) {
  const collectionRoute = ENTITY_ROUTES.get(entity.entityType);
  if (entity.recordState === 'published' && hasDetailPage(entity, detailPageSlugs)) {
    return `${collectionRoute}/${entity.slug}`;
  }
  return collectionRoute;
}

function buildSearchDocument(entity, file, detailPageSlugs) {
  validateSummarySupport(entity, file);
  const { aliases, displayAliases } = deriveAliases(entity, file);

  return {
    id: entity.id,
    documentType: 'entity',
    entityType: entity.entityType,
    slug: entity.slug,
    route: deriveEntityRoute(entity, detailPageSlugs),
    displayName: entity.displayName,
    aliases,
    displayAliases,
    keywords: deriveKeywords(entity),
    summary: entity.summary,
    recordState: entity.recordState,
    sourceSchemaVersion: entity.schemaVersion
  };
}

function assertUniqueDocuments(documents, detailPageSlugs) {
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
    const collectionRoute = ENTITY_ROUTES.get(document.entityType);
    const expectedRoute = document.recordState === 'published' && hasDetailPage(document, detailPageSlugs)
      ? `${collectionRoute}/${document.slug}`
      : collectionRoute;
    if (document.route !== expectedRoute) {
      throw new Error(`${document.id}: route 必须指向当前真实路由 ${expectedRoute}`);
    }
  }
}

export function buildSearchDocuments(records, mode, detailPageSlugs = new Set()) {
  const config = MODE_CONFIG.get(mode);
  if (!config) throw new Error(`未知 mode：${mode}`);
  if (!(detailPageSlugs instanceof Set) && !(detailPageSlugs instanceof Map)) throw new Error('detailPageSlugs 必须是 Set 或 Map');

  const documents = [];
  const skippedByState = new Map();
  for (const record of records) {
    const entity = record.entity ?? record.weapon;
    requireSearchShape(entity, record.file);
    if (!config.includedStates.has(entity.recordState)) {
      skippedByState.set(entity.recordState, (skippedByState.get(entity.recordState) ?? 0) + 1);
      continue;
    }
    documents.push(buildSearchDocument(entity, record.file, detailPageSlugs));
  }

  documents.sort((left, right) =>
    compareText(left.entityType, right.entityType) ||
    compareText(left.slug, right.slug) ||
    compareText(left.id, right.id));
  assertUniqueDocuments(documents, detailPageSlugs);

  return { documents, skippedByState };
}

export async function resolvePublishedWeaponDetailPageSlugs(records, detailPagesDir = WEAPON_PAGES_DIR, requireLegacyMarker = true) {
  const slugs = new Set();
  for (const record of records) {
    const entity = record.entity ?? record.weapon;
    requireSearchShape(entity, record.file);
    if (entity.entityType !== 'weapon' || entity.recordState !== 'published') continue;
    const pageFile = path.join(detailPagesDir, `${entity.slug}.html`);
    let html;
    try {
      html = await fs.readFile(pageFile, 'utf8');
    } catch (cause) {
      if (cause.code === 'ENOENT') {
        throw new Error(`${record.file}: 已发布 Weapon 缺少详情页 ${path.relative(ROOT_DIR, pageFile).replaceAll('\\', '/')}`);
      }
      throw cause;
    }
    const canonical = `${SITE_ORIGIN}${WEAPON_ROUTE}/${entity.slug}`;
    if (requireLegacyMarker && !html.includes(WEAPON_PAGE_MARKER)) {
      throw new Error(`${record.file}: 详情页缺少生成标记：pages/generated/weapons/${entity.slug}.html`);
    }
    if (!html.includes(`<link rel="canonical" href="${canonical}">`)) {
      throw new Error(`${record.file}: 详情页 canonical 与搜索 route 不一致：${canonical}`);
    }
    slugs.add(entity.slug);
  }
  return slugs;
}

export async function resolvePublishedCharacterDetailPageSlugs(records, detailPagesDir = CHARACTER_PAGES_DIR) {
  const slugs = new Set();
  for (const record of records) {
    const entity = record.entity ?? record.weapon;
    requireSearchShape(entity, record.file);
    if (entity.entityType !== 'character' || entity.recordState !== 'published') continue;
    const pageFile = path.join(detailPagesDir, `${entity.slug}.html`);
    let html;
    try {
      html = await fs.readFile(pageFile, 'utf8');
    } catch (cause) {
      if (cause.code === 'ENOENT') throw new Error(`${record.file}: 已发布 Character 缺少详情页 ${path.relative(ROOT_DIR, pageFile).replaceAll('\\', '/')}`);
      throw cause;
    }
    const canonical = `${SITE_ORIGIN}${CHARACTER_ROUTE}/${entity.slug}`;
    if (!html.includes(`<link rel="canonical" href="${canonical}"`)) {
      throw new Error(`${record.file}: 详情页 canonical 与搜索 route 不一致：${canonical}`);
    }
    slugs.add(entity.slug);
  }
  return slugs;
}

export async function resolvePublishedBossDetailPageSlugs(records, detailPagesDir = BOSS_PAGES_DIR) {
  const slugs = new Set();
  for (const record of records) {
    const entity = record.entity ?? record.weapon;
    requireSearchShape(entity, record.file);
    if (entity.entityType !== 'boss' || entity.recordState !== 'published') continue;
    const pageFile = path.join(detailPagesDir, `${entity.slug}.html`);
    let html;
    try {
      html = await fs.readFile(pageFile, 'utf8');
    } catch (cause) {
      if (cause.code === 'ENOENT') throw new Error(`${record.file}: 已发布 Boss 缺少详情页 ${path.relative(ROOT_DIR, pageFile).replaceAll('\\', '/')}`);
      throw cause;
    }
    const canonical = `${SITE_ORIGIN}${BOSS_ROUTE}/${entity.slug}`;
    if (!html.includes(`<link rel="canonical" href="${canonical}"`)) {
      throw new Error(`${record.file}: 详情页 canonical 与搜索 route 不一致：${canonical}`);
    }
    slugs.add(entity.slug);
  }
  return slugs;
}

async function writeDeterministicJson(documents, outputFile) {
  const output = `${JSON.stringify(documents, null, 2)}\n`;
  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  let previous = null;
  try {
    previous = await fs.readFile(outputFile, 'utf8');
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause;
  }

  if (previous === output) return false;
  await fs.writeFile(outputFile, output, 'utf8');
  return true;
}

async function main() {
  const { mode, detailPagesDir, characterDetailPagesDir, bossDetailPagesDir, requireLegacyMarker } = parseOptions(process.argv.slice(2));
  const config = MODE_CONFIG.get(mode);
  runSchemaValidator();
  const records = [
    ...await readEntityRecords(WEAPONS_DIR, 'data/weapons'),
    ...await readEntityRecords(CHARACTERS_DIR, 'data/characters'),
    ...await readEntityRecords(BOSSES_DIR, 'data/bosses')
  ];
  const detailPageSlugs = new Map([
    ['weapon', await resolvePublishedWeaponDetailPageSlugs(records, detailPagesDir, requireLegacyMarker)],
    ['character', await resolvePublishedCharacterDetailPageSlugs(records, characterDetailPagesDir)],
    ['boss', await resolvePublishedBossDetailPageSlugs(records, bossDetailPagesDir)]
  ]);
  const { documents, skippedByState } = buildSearchDocuments(records, mode, detailPageSlugs);
  const changed = await writeDeterministicJson(documents, config.outputFile);
  const relativeOutput = path.relative(ROOT_DIR, config.outputFile).replaceAll('\\', '/');

  console.log('Search index generation passed.');
  console.log(`Mode: ${mode}`);
  console.log(`Entity records read: ${records.length}`);
  console.log(`Weapon records read: ${records.filter(({ entity }) => entity.entityType === 'weapon').length}`);
  console.log(`Character records read: ${records.filter(({ entity }) => entity.entityType === 'character').length}`);
  console.log(`Boss records read: ${records.filter(({ entity }) => entity.entityType === 'boss').length}`);
  console.log(`Search documents written: ${documents.length}`);
  for (const state of [...KNOWN_RECORD_STATES].sort(compareText)) {
    console.log(`Skipped ${state}: ${skippedByState.get(state) ?? 0}`);
  }
  console.log(`Entity routes: ${uniqueSortedStrings(documents.map((document) => document.route)).join(', ') || '(none)'}`);
  console.log(`Output: ${relativeOutput} (${changed ? 'updated' : 'unchanged'})`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE;
if (isMain) {
  main().catch((cause) => {
    console.error(`Search index generation failed: ${cause.message}`);
    process.exitCode = 1;
  });
}

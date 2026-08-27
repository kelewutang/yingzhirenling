import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const WEAPONS_DIR = path.join(ROOT_DIR, 'data', 'weapons');
const SOURCES_DIR = path.join(ROOT_DIR, 'data', 'sources');
const VERSIONS_DIR = path.join(ROOT_DIR, 'data', 'versions');
const FACT_KEYS_FILE = path.join(ROOT_DIR, 'data', 'registries', 'fact-keys.json');
const VALIDATOR_FILE = path.join(SCRIPT_DIR, 'validate-data.mjs');
const OUTPUT_DIR = path.join(ROOT_DIR, 'pages', 'generated', 'weapons');

const SCHEMA_VERSION = '1.0-implementation';
const GENERATED_MARKER = '<!-- generated-by: build-weapon-pages.mjs -->';
const SITE_ORIGIN = 'https://www.yingzhirenling.cn';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_RECORD_STATES = new Set(['draft', 'published', 'archived']);
const SUPPORTED_STATUSES = new Set([
  'official',
  'observation',
  'third-party',
  'editorial',
  'pending-review'
]);
const STATUS_LABELS = new Map([
  ['official', '官方确认'],
  ['observation', '试玩观察'],
  ['third-party', '第三方信息'],
  ['editorial', '编辑推测'],
  ['pending-review', '待后续核查']
]);
const FACT_ORDER = [
  'weapon.exists',
  'weapon.name',
  'weapon.kind',
  'weapon.publicAppearance',
  'weapon.observedTrait',
  'weapon.editorRating',
  'weapon.acquisition'
];
const FACT_TITLES = new Map([
  ['weapon.exists', '公开记录'],
  ['weapon.name', '名称记录'],
  ['weapon.kind', '武器类型'],
  ['weapon.publicAppearance', '公开出现方式'],
  ['weapon.observedTrait', '演示观察'],
  ['weapon.editorRating', '发售前编辑预估'],
  ['weapon.acquisition', '获取方式']
]);
const APPEARANCE_LABELS = new Map([
  ['demo', '已在公开试玩资料中出现'],
  ['trailer', '已在公开预告片中出现'],
  ['promotional-material', '已在公开宣传材料中出现'],
  ['state-of-play', '已在 State of Play 公开材料中出现']
]);
const SOURCE_TYPE_LABELS = new Map([
  ['official-article', '官方发布材料'],
  ['media-hands-on', '媒体试玩']
]);
const PENDING_MESSAGES = new Map([
  ['weapon.observedTrait', '详细动作与性能尚待更多可靠资料确认。'],
  ['weapon.acquisition', '获取方式尚待后续官方资料或正式版验证。']
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function requireNonEmptyString(value, field, file) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${file}: ${field} 必须是非空字符串`);
  }
  return value.trim();
}

function requireIsoDate(value, field, file) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${file}: ${field} 必须是 YYYY-MM-DD`);
  }
  return value;
}

function formatDate(value) {
  requireIsoDate(value, 'date', 'render');
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function safeExternalUrl(value, field, file) {
  const text = requireNonEmptyString(value, field, file);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${file}: ${field} 不是合法 URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${file}: ${field} 只允许 http/https URL`);
  }
  return url.href;
}

function truncateText(value, maxLength) {
  const characters = [...value];
  return characters.length <= maxLength
    ? value
    : `${characters.slice(0, maxLength - 1).join('')}…`;
}

function normalizeHtmlOutput(value) {
  const lines = value.split('\n').map((line) => line.trim().length === 0 ? '' : line);
  return `${lines.join('\n').trimEnd()}\n`;
}

function sourceAnchor(sourceId) {
  return `source-${sourceId.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
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

async function readJsonDirectory(directory, label) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort(compareText);

  return Promise.all(files.map(async (name) => {
    const absoluteFile = path.join(directory, name);
    const file = path.relative(ROOT_DIR, absoluteFile).replaceAll('\\', '/');
    let value;
    try {
      value = JSON.parse(await fs.readFile(absoluteFile, 'utf8'));
    } catch (cause) {
      throw new Error(`${file}: JSON 读取失败：${cause.message}`);
    }
    return { file, value, label };
  }));
}

function indexRecords(records, label) {
  const byId = new Map();
  const fileById = new Map();
  for (const { file, value } of records) {
    const id = requireNonEmptyString(value.id, `${label}.id`, file);
    if (byId.has(id)) {
      throw new Error(`${file}: 重复 ${label} id：${id}（已见于 ${fileById.get(id)}）`);
    }
    byId.set(id, value);
    fileById.set(id, file);
  }
  return { byId, fileById };
}

function validateSource(source, file) {
  if (source.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`${file}: schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  requireNonEmptyString(source.publisher, 'publisher', file);
  requireNonEmptyString(source.title, 'title', file);
  safeExternalUrl(source.url, 'url', file);
  if (source.publishedAt !== null) requireIsoDate(source.publishedAt, 'publishedAt', file);
}

function validateVersion(version, file) {
  if (version.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`${file}: schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  requireNonEmptyString(version.displayName, 'displayName', file);
}

function requireFactString(fact, file) {
  return requireNonEmptyString(fact.value, `${fact.key}.value`, file);
}

function renderRatingValue(fact, file) {
  const value = fact.value;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isInteger(value.score) || !Number.isInteger(value.max) ||
      value.max <= 0 || value.score < 0 || value.score > value.max) {
    throw new Error(`${file}: ${fact.key}.value 必须是合法 rating`);
  }
  const filled = '★'.repeat(value.score);
  const empty = '☆'.repeat(value.max - value.score);
  return `${filled}${empty}（${value.score}/${value.max}）`;
}

function renderFactValue(fact, file) {
  if (fact.status === 'pending-review') {
    if (fact.value !== null) {
      throw new Error(`${file}: pending-review Fact ${fact.id} 必须使用 null，避免泄漏待核值`);
    }
    return PENDING_MESSAGES.get(fact.key) ?? '这项信息尚待更多可靠资料确认。';
  }

  switch (fact.key) {
    case 'weapon.exists':
      if (fact.value !== true) {
        throw new Error(`${file}: published Weapon 的 weapon.exists 必须为 true`);
      }
      return '已在可核查的发售前材料中出现。';
    case 'weapon.name':
    case 'weapon.kind':
    case 'weapon.observedTrait':
    case 'weapon.acquisition':
      return requireFactString(fact, file);
    case 'weapon.publicAppearance': {
      const label = APPEARANCE_LABELS.get(fact.value);
      if (!label) throw new Error(`${file}: 不支持 publicAppearance=${String(fact.value)}`);
      return label;
    }
    case 'weapon.editorRating':
      return renderRatingValue(fact, file);
    default:
      throw new Error(`${file}: 详情页尚无 Fact key=${fact.key} 的展示规则`);
  }
}

function validateWeapon(weapon, file, factKeySet, sourcesById, versionsById) {
  if (weapon.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`${file}: schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  if (weapon.entityType !== 'weapon') throw new Error(`${file}: entityType 必须为 weapon`);
  const slug = requireNonEmptyString(weapon.slug, 'slug', file);
  if (!SLUG_PATTERN.test(slug)) throw new Error(`${file}: slug 不符合稳定 URL 规则：${slug}`);
  requireNonEmptyString(weapon.id, 'id', file);
  requireNonEmptyString(weapon.displayName, 'displayName', file);
  requireNonEmptyString(weapon.summary, 'summary', file);
  requireIsoDate(weapon.updatedAt, 'updatedAt', file);
  if (!KNOWN_RECORD_STATES.has(weapon.recordState)) {
    throw new Error(`${file}: 不支持 recordState=${weapon.recordState}`);
  }
  if (!Array.isArray(weapon.facts)) throw new Error(`${file}: facts 必须是数组`);

  const factIds = new Set();
  const factKeys = new Set();
  for (const fact of weapon.facts) {
    const factId = requireNonEmptyString(fact.id, 'fact.id', file);
    if (factIds.has(factId)) throw new Error(`${file}: 重复 Fact id：${factId}`);
    factIds.add(factId);
    if (fact.status === 'release-verified') {
      throw new Error(`${file}: 发售前详情页禁止 release-verified：${factId}`);
    }
    if (!SUPPORTED_STATUSES.has(fact.status)) {
      throw new Error(`${file}: 详情页不支持 Fact status=${fact.status}`);
    }
    if (!factKeySet.has(fact.key)) throw new Error(`${file}: 未注册 Fact key：${fact.key}`);
    if (!FACT_TITLES.has(fact.key)) {
      throw new Error(`${file}: 详情页尚无 Fact key=${fact.key} 的标题规则`);
    }
    if (factKeys.has(fact.key)) throw new Error(`${file}: 详情页暂不支持重复 Fact key：${fact.key}`);
    factKeys.add(fact.key);
    if (!Array.isArray(fact.sourceIds) || !Array.isArray(fact.basisFactIds)) {
      throw new Error(`${file}: ${factId} 的 sourceIds/basisFactIds 必须是数组`);
    }
    for (const sourceId of fact.sourceIds) {
      if (!sourcesById.has(sourceId)) throw new Error(`${file}: ${factId} 引用了缺失 Source：${sourceId}`);
    }
    if (!versionsById.has(fact.gameVersionId)) {
      throw new Error(`${file}: ${factId} 引用了缺失 GameVersion：${fact.gameVersionId}`);
    }
    requireIsoDate(fact.checkedAt, `${factId}.checkedAt`, file);
    renderFactValue(fact, file);
  }

  if (weapon.recordState === 'published') {
    for (const requiredKey of ['weapon.exists', 'weapon.name', 'weapon.kind', 'weapon.publicAppearance']) {
      if (!factKeys.has(requiredKey)) throw new Error(`${file}: published Weapon 缺少 ${requiredKey}`);
    }
  }
}

function collectPageSources(weapon, sourcesById) {
  const sourceIds = [...new Set(weapon.facts.flatMap((fact) => fact.sourceIds))].sort(compareText);
  const uniqueSources = [];
  const byUrl = new Map();
  const anchorById = new Map();

  for (const sourceId of sourceIds) {
    const source = sourcesById.get(sourceId);
    const normalizedUrl = new URL(source.url).href;
    let entry = byUrl.get(normalizedUrl);
    if (!entry) {
      entry = { source, anchor: sourceAnchor(sourceId) };
      byUrl.set(normalizedUrl, entry);
      uniqueSources.push(entry);
    }
    anchorById.set(sourceId, entry.anchor);
  }

  return { uniqueSources, anchorById };
}

function renderMetaRow(term, descriptionHtml) {
  return `<div class="info-source"><dt>${escapeHtml(term)}</dt><dd>${descriptionHtml}</dd></div>`;
}

function renderFactCard(fact, file, context) {
  const title = FACT_TITLES.get(fact.key);
  const statusLabel = STATUS_LABELS.get(fact.status);
  const value = renderFactValue(fact, file);
  const sourceLinks = fact.sourceIds.map((sourceId) => {
    const source = context.sourcesById.get(sourceId);
    const anchor = context.sourceAnchorById.get(sourceId);
    return `<a href="#${escapeHtml(anchor)}">${escapeHtml(source.publisher)}</a>`;
  });
  const version = context.versionsById.get(fact.gameVersionId);
  const meta = [];
  if (sourceLinks.length > 0) meta.push(renderMetaRow('来源', sourceLinks.join('、')));
  if (fact.basisFactIds.length > 0) {
    const basisLabels = fact.basisFactIds.map((factId) => {
      const basisFact = context.factsById.get(factId);
      if (!basisFact) throw new Error(`${file}: ${fact.id} 引用了缺失 basisFact：${factId}`);
      return FACT_TITLES.get(basisFact.key);
    });
    meta.push(renderMetaRow('判断依据', escapeHtml([...new Set(basisLabels)].join('、'))));
  }
  meta.push(renderMetaRow('资料阶段', escapeHtml(version.displayName)));
  meta.push(renderMetaRow('核验时间', `<time datetime="${escapeHtml(fact.checkedAt)}">${escapeHtml(formatDate(fact.checkedAt))}</time>`));

  const editorialNote = fact.status === 'editorial'
    ? '<p class="info-provenance__description">本站发售前编辑判断，不是官方评分或试玩客观数值。</p>'
    : '';

  return `
        <aside class="info-provenance" data-info-scope="fact" data-fact-id="${escapeHtml(fact.id)}" data-status="${escapeHtml(fact.status)}" aria-labelledby="${escapeHtml(sourceAnchor(fact.id))}-title">
          <div class="info-provenance__intro">
            <span class="info-status" data-status="${escapeHtml(fact.status)}">${escapeHtml(statusLabel)}</span>
            <div class="info-provenance__content">
              <h3 class="info-provenance__title" id="${escapeHtml(sourceAnchor(fact.id))}-title">${escapeHtml(title)}</h3>
              <p class="info-provenance__description">${escapeHtml(value)}</p>
              ${editorialNote}
            </div>
          </div>
          <dl class="info-provenance__meta">${meta.join('')}</dl>
        </aside>`;
}

function renderFactGroup(sectionId, title, keys, weapon, file, context) {
  const cards = keys
    .map((key) => weapon.facts.find((fact) => fact.key === key))
    .filter(Boolean)
    .map((fact) => renderFactCard(fact, file, context));
  if (cards.length === 0) return '';
  return `
      <section aria-labelledby="${escapeHtml(sectionId)}">
        <h2 id="${escapeHtml(sectionId)}">${escapeHtml(title)}</h2>${cards.join('')}
      </section>`;
}

function renderSource(entry) {
  const { source, anchor } = entry;
  const sourceType = SOURCE_TYPE_LABELS.get(source.sourceType);
  if (!sourceType) {
    throw new Error(`${source.id}: 详情页尚无 sourceType=${source.sourceType} 的用户文案`);
  }
  const published = source.publishedAt
    ? renderMetaRow('发布日期', `<time datetime="${escapeHtml(source.publishedAt)}">${escapeHtml(formatDate(source.publishedAt))}</time>`)
    : '';
  return `
        <aside class="info-provenance" data-info-scope="source" id="${escapeHtml(anchor)}" aria-labelledby="${escapeHtml(anchor)}-title">
          <div class="info-provenance__intro">
            <span class="tag tag-gold">${escapeHtml(sourceType)}</span>
            <div class="info-provenance__content">
              <h3 class="info-provenance__title" id="${escapeHtml(anchor)}-title">${escapeHtml(source.title)}</h3>
              <p class="info-provenance__description">${escapeHtml(source.publisher)}</p>
            </div>
          </div>
          <dl class="info-provenance__meta">
            ${published}
            ${renderMetaRow('原始来源', `<a href="${escapeHtml(safeExternalUrl(source.url, 'url', source.id))}" target="_blank" rel="noopener noreferrer">查看来源页面</a>`)}
          </dl>
        </aside>`;
}

function renderNavigation() {
  return `
  <nav class="navbar" aria-label="主导航">
    <div class="nav-inner">
      <a href="/" class="nav-logo"><span>影之刃零</span></a>
      <button class="nav-toggle" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="primary-navigation">☰</button>
      <ul class="nav-links" id="primary-navigation">
        <li><a href="/">首页</a></li>
        <li><a href="/guide">攻略中心</a></li>
        <li><a href="/weapons" class="active">武器图鉴</a></li>
        <li><a href="/characters">角色图鉴</a></li>
        <li><a href="/bosses">Boss攻略</a></li>
        <li><a href="/world">世界观</a></li>
        <li><a href="/videos">视频中心</a></li>
        <li><a href="/about">购买指南</a></li>
      </ul>
      <button class="nav-search-btn" type="button" onclick="openSearch()" aria-label="搜索">🔍</button>
      <div class="theme-switcher" aria-label="主题切换">
        <button class="theme-btn active" type="button" data-theme="default" title="赤焰（默认）" aria-label="使用赤焰主题" onclick="switchTheme('default')"></button>
        <button class="theme-btn" type="button" data-theme="qing" title="墨青" aria-label="使用墨青主题" onclick="switchTheme('qing')"></button>
        <button class="theme-btn" type="button" data-theme="light" title="昼白（浅色）" aria-label="使用昼白主题" onclick="switchTheme('light')"></button>
      </div>
    </div>
  </nav>`;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand"><div class="footer-logo">影之刃零攻略站</div><p>非官方玩家攻略站，游戏版权归北京灵游坊网络科技有限公司所有。</p></div>
      <div class="footer-col"><h4>攻略</h4><ul><li><a href="/guide">攻略中心</a></li><li><a href="/weapons">武器图鉴</a></li><li><a href="/bosses">Boss攻略</a></li><li><a href="/characters">角色图鉴</a></li></ul></div>
      <div class="footer-col"><h4>资料</h4><ul><li><a href="/world">世界观设定</a></li><li><a href="/videos">视频中心</a></li><li><a href="/about">购买指南</a></li><li><a href="/about-site">关于本站</a></li></ul></div>
      <div class="footer-col"><h4>官方渠道</h4><ul><li><a href="https://www.taptap.cn/app/358885" target="_blank" rel="noopener noreferrer">TapTap</a></li><li><a href="https://store.steampowered.com/app/4115450/" target="_blank" rel="noopener noreferrer">Steam</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>© 2026 影之刃零攻略站 · yingzhirenling.cn</span><span>玩家公益站点</span></div>
  </footer>`;
}

function renderWeaponPage(weapon, file, sourcesById, versionsById) {
  const canonicalPath = `/weapons/${weapon.slug}`;
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const title = `${weapon.displayName} - 影之刃零武器资料 | 影之刃零攻略站`;
  const description = truncateText(`${weapon.displayName}：${weapon.summary}`, 155);
  const factsById = new Map(weapon.facts.map((fact) => [fact.id, fact]));
  const { uniqueSources, anchorById } = collectPageSources(weapon, sourcesById);
  const context = { factsById, sourcesById, versionsById, sourceAnchorById: anchorById };

  const coreFacts = renderFactGroup(
    'weapon-core-facts-title',
    '核心资料',
    ['weapon.exists', 'weapon.name', 'weapon.kind', 'weapon.publicAppearance'],
    weapon,
    file,
    context
  );
  const observationFacts = renderFactGroup(
    'weapon-observation-facts-title',
    '试玩与公开实机观察',
    ['weapon.observedTrait'],
    weapon,
    file,
    context
  );
  const editorialFacts = renderFactGroup(
    'weapon-editorial-facts-title',
    '编辑评价',
    ['weapon.editorRating'],
    weapon,
    file,
    context
  );
  const acquisitionFacts = renderFactGroup(
    'weapon-acquisition-facts-title',
    '获取方式',
    ['weapon.acquisition'],
    weapon,
    file,
    context
  );
  const sourceSection = uniqueSources.length > 0
    ? `
      <section aria-labelledby="weapon-sources-title">
        <h2 id="weapon-sources-title">本页来源</h2>
        <p>这里只列出本页事实实际引用的来源；来源类型与事实可信状态分别标记。</p>
        ${uniqueSources.map(renderSource).join('')}
      </section>`
    : '';

  return normalizeHtmlOutput(`<!DOCTYPE html>
${GENERATED_MARKER}
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
${renderNavigation()}

  <main class="container">
    <header class="page-header">
      <div class="page-breadcrumb"><a href="/">首页</a> &gt; <a href="/weapons">武器图鉴</a> &gt; ${escapeHtml(weapon.displayName)}</div>
      <h1 class="page-title">${escapeHtml(weapon.displayName)}</h1>
      <p class="page-meta">资料更新：<time datetime="${escapeHtml(weapon.updatedAt)}">${escapeHtml(formatDate(weapon.updatedAt))}</time></p>
      <p>${escapeHtml(weapon.summary)}</p>
    </header>

    <article class="article">
      <div class="alert alert-info">本页整理发售前公开资料。每条事实单独标注“官方确认、试玩观察、第三方信息、编辑推测或待后续核查”；官方来源中的画面观察不自动等同于官方文字确认。</div>
      ${coreFacts}
      ${observationFacts}
      ${editorialFacts}
      ${acquisitionFacts}
      ${sourceSection}
      <p><a class="btn btn-outline" href="/weapons">返回武器图鉴</a></p>
    </article>
  </main>

${renderFooter()}

  <button class="back-to-top" type="button" aria-label="回到顶部">↑</button>
  <script src="/js/main.js"></script>
</body>
</html>
`);
}

async function inspectOutputDirectory(expectedFiles) {
  let entries;
  try {
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === 'ENOENT') return [];
    throw cause;
  }

  const staleFiles = [];
  for (const entry of entries) {
    const absoluteFile = path.join(OUTPUT_DIR, entry.name);
    if (!entry.isFile() || !entry.name.endsWith('.html')) {
      throw new Error(`pages/generated/weapons/ 是生成输出目录，发现非预期条目：${entry.name}`);
    }
    const content = await fs.readFile(absoluteFile, 'utf8');
    if (!content.includes(GENERATED_MARKER)) {
      throw new Error(`拒绝覆盖非生成文件：pages/generated/weapons/${entry.name}`);
    }
    if (!expectedFiles.has(entry.name)) staleFiles.push(absoluteFile);
  }
  return staleFiles.sort(compareText);
}

async function writeIfChanged(file, content) {
  let previous = null;
  try {
    previous = await fs.readFile(file, 'utf8');
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause;
  }
  if (previous === content) return false;
  await fs.writeFile(file, content, 'utf8');
  return true;
}

async function main() {
  runSchemaValidator();
  const [weaponRecords, sourceRecords, versionRecords, factKeyRegistry] = await Promise.all([
    readJsonDirectory(WEAPONS_DIR, 'Weapon'),
    readJsonDirectory(SOURCES_DIR, 'Source'),
    readJsonDirectory(VERSIONS_DIR, 'GameVersion'),
    fs.readFile(FACT_KEYS_FILE, 'utf8').then(JSON.parse)
  ]);

  const { byId: sourcesById, fileById: sourceFileById } = indexRecords(sourceRecords, 'Source');
  const { byId: versionsById, fileById: versionFileById } = indexRecords(versionRecords, 'GameVersion');
  for (const [id, source] of sourcesById) validateSource(source, sourceFileById.get(id));
  for (const [id, version] of versionsById) validateVersion(version, versionFileById.get(id));

  if (!factKeyRegistry || !Array.isArray(factKeyRegistry.factKeys)) {
    throw new Error('data/registries/fact-keys.json: factKeys 必须是数组');
  }
  const factKeySet = new Set(factKeyRegistry.factKeys.map((entry) => entry.key));
  const published = [];
  const skipped = new Map();
  const slugs = new Map();

  for (const { file, value: weapon } of weaponRecords) {
    validateWeapon(weapon, file, factKeySet, sourcesById, versionsById);
    if (slugs.has(weapon.slug)) {
      throw new Error(`${file}: 重复 Weapon slug：${weapon.slug}（已见于 ${slugs.get(weapon.slug)}）`);
    }
    slugs.set(weapon.slug, file);
    if (weapon.recordState !== 'published') {
      skipped.set(weapon.recordState, (skipped.get(weapon.recordState) ?? 0) + 1);
      continue;
    }
    published.push({ file, weapon });
  }

  published.sort((left, right) => compareText(left.weapon.slug, right.weapon.slug));
  const pages = published.map(({ file, weapon }) => ({
    fileName: `${weapon.slug}.html`,
    route: `/weapons/${weapon.slug}`,
    content: renderWeaponPage(weapon, file, sourcesById, versionsById)
  }));
  const expectedFiles = new Set(pages.map((page) => page.fileName));
  const staleFiles = await inspectOutputDirectory(expectedFiles);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const staleFile of staleFiles) await fs.unlink(staleFile);

  let changed = 0;
  for (const page of pages) {
    if (await writeIfChanged(path.join(OUTPUT_DIR, page.fileName), page.content)) changed += 1;
  }

  console.log('Weapon detail page generation passed.');
  console.log(`Weapon records read: ${weaponRecords.length}`);
  console.log(`Published pages written: ${pages.length}`);
  console.log(`Skipped draft: ${skipped.get('draft') ?? 0}`);
  console.log(`Skipped archived: ${skipped.get('archived') ?? 0}`);
  console.log(`Stale generated pages removed: ${staleFiles.length}`);
  console.log(`Files updated: ${changed}`);
  for (const page of pages) console.log(`Public route: ${page.route}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE;
if (isMain) {
  main().catch((cause) => {
    console.error(`Weapon detail page generation failed: ${cause.message}`);
    process.exitCode = 1;
  });
}

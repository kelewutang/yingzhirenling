import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const execFile = promisify(execFileCallback);

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const PRODUCTION_ORIGIN = 'https://www.yingzhirenling.cn';
export const PRODUCTION_HOST = 'www.yingzhirenling.cn';
const ENTITY_DIRECTORY_ROUTES = new Map([
  ['weapons', '/weapons'],
  ['characters', '/characters'],
  ['bosses', '/bosses'],
  ['locations', '/world']
]);
const EXACT_ROUTE_FILES = new Map([
  ['src/pages/index.astro', ['/']],
  ['src/pages/videos.astro', ['/videos']],
  ['src/pages/weapons.astro', ['/weapons']],
  ['src/pages/characters.astro', ['/characters']],
  ['src/pages/bosses.astro', ['/bosses']],
  ['src/pages/world.astro', ['/world']],
  ['pages/guide.html', ['/guide']],
  ['pages/about.html', ['/about']],
  ['pages/about-site.html', ['/about-site']],
  ['scripts/astro/copy-legacy-static.mjs', ['/guide', '/about', '/about-site']],
  ['scripts/astro/site-shell.mjs', ['/guide', '/about', '/about-site']]
]);

function normalizedFile(file) {
  return String(file).replaceAll('\\', '/').replace(/^\.\//, '');
}

function canonicalUrl(value, origin = PRODUCTION_ORIGIN) {
  const url = new URL(value);
  if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`not a production canonical URL: ${value}`);
  }
  if (url.pathname !== '/' && url.pathname.endsWith('/')) throw new Error(`trailing-slash canonical URL: ${value}`);
  if (url.pathname.endsWith('.html')) throw new Error(`legacy HTML URL: ${value}`);
  return `${origin}${url.pathname}`;
}

export function parseSitemapCanonicalUrls(xml, { origin = PRODUCTION_ORIGIN } = {}) {
  if (typeof xml !== 'string') throw new Error('sitemap XML must be a string');
  const values = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  if (values.length === 0) throw new Error('sitemap contains no canonical URLs');
  const canonicalUrls = values.map((value) => canonicalUrl(value, origin));
  if (new Set(canonicalUrls).size !== canonicalUrls.length) throw new Error('sitemap contains duplicate canonical URLs');
  return canonicalUrls;
}

export function filterCanonicalAllowlist(candidates, allowlist) {
  const allowed = new Set(allowlist);
  const accepted = [];
  const seen = new Set();
  for (const candidate of candidates) {
    let canonical;
    try {
      canonical = canonicalUrl(candidate);
    } catch {
      continue;
    }
    if (!allowed.has(canonical) || seen.has(canonical)) continue;
    seen.add(canonical);
    accepted.push(canonical);
  }
  return accepted;
}

function routesForCollection(allowlist, route) {
  const prefix = `${PRODUCTION_ORIGIN}${route}`;
  return allowlist.filter((url) => url === prefix || url.startsWith(`${prefix}/`));
}

function isKnownNonProductionFile(file) {
  return file === 'README.md'
    || file === '.nvmrc'
    || file.startsWith('docs/')
    || file.startsWith('tests/')
    || file.startsWith('experiments/')
    || file.startsWith('.github/')
    || file.startsWith('tmp/')
    || /^scripts\/(?:test-|validate-|check-)/.test(file)
    || /^scripts\/astro\/check-/.test(file)
    || file === 'scripts/astro/verify-dist.mjs'
    || file === 'scripts/build-search-index.mjs'
    || file === 'scripts/build-weapon-pages.mjs'
    || (file.startsWith('public/') && /^[A-Za-z0-9-]{8,128}\.txt$/.test(file.slice('public/'.length)));
}

function fullImpactReason(file) {
  if (file === 'netlify.toml' || file === 'astro.config.mjs' || file === 'package.json' || file === 'package-lock.json') return 'build or deployment configuration changed';
  if (file.startsWith('src/layouts/') || file.startsWith('src/components/') || file.startsWith('src/lib/')) return 'shared Astro rendering or metadata changed';
  if (file.startsWith('css/') || file.startsWith('js/') || file.startsWith('public/') || file.startsWith('assets/media/')) return 'shared visible production asset changed';
  if (file === 'src/pages/sitemap.xml.js' || file.startsWith('data/sources/') || file.startsWith('data/relations/') || file.startsWith('data/registries/') || file.startsWith('data/systems/') || file.startsWith('data/versions/') || file === 'data/media.json') return 'shared Knowledge or sitemap projection changed';
  return null;
}

function entityDirectoryForFile(file) {
  const match = /^data\/(weapons|characters|bosses|locations)\/[^/]+\.json$/.exec(file);
  return match ? match[1] : null;
}

export function selectChangedCanonicalUrls({ changedFiles, changes, allowlist, entityRoutesByFile = new Map() }) {
  const candidates = [];
  const fallbackFiles = [];
  const entityRoutes = entityRoutesByFile instanceof Map ? entityRoutesByFile : new Map(Object.entries(entityRoutesByFile));
  const normalizedChanges = (changes || changedFiles || []).map(normalizeChange);

  for (const change of normalizedChanges) {
    const file = change.afterPath || change.beforePath;
    const entityDirectory = (change.beforePath && entityDirectoryForFile(change.beforePath)) || (change.afterPath && entityDirectoryForFile(change.afterPath));

    if (entityDirectory) {
      const routes = entityRoutes.get(entityChangeKey(change));
      if (routes === undefined) {
        fallbackFiles.push(file);
      } else {
        candidates.push(...routes);
      }
      continue;
    }

    if (isKnownNonProductionFile(file)) continue;

    const exactRoutes = EXACT_ROUTE_FILES.get(file);
    if (exactRoutes) {
      candidates.push(...exactRoutes.map((route) => `${PRODUCTION_ORIGIN}${route}`));
      continue;
    }

    const detailTemplate = /^src\/pages\/(weapons|characters|bosses|world)\/\[slug\]\.astro$/.exec(file);
    if (detailTemplate) {
      candidates.push(...routesForCollection(allowlist, `/${detailTemplate[1]}`));
      continue;
    }

    const reason = fullImpactReason(file);
    if (reason) {
      fallbackFiles.push(file);
      continue;
    }

    fallbackFiles.push(file);
  }

  if (fallbackFiles.length > 0) {
    return {
      urls: [...allowlist],
      fallbackReason: `full canonical set: ${fullImpactReason(fallbackFiles[0]) || `unmapped production-affecting file ${fallbackFiles[0]}`}`,
      changedFiles: normalizedChanges.map(changeDisplay)
    };
  }

  return {
    urls: filterCanonicalAllowlist(candidates, allowlist),
    fallbackReason: null,
    changedFiles: normalizedChanges.map(changeDisplay)
  };
}

export function buildIndexNowPayload({ key, urlList }) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error('IndexNow key must contain 8-128 letters, digits, or dashes');
  if (!Array.isArray(urlList) || urlList.length === 0) throw new Error('IndexNow payload requires at least one URL');
  if (urlList.length > 10_000) throw new Error('IndexNow payload exceeds the 10,000 URL protocol limit');
  const normalizedUrls = filterCanonicalAllowlist(urlList, urlList);
  if (normalizedUrls.length !== urlList.length) throw new Error('IndexNow payload URLs must be unique production canonical URLs');
  return {
    host: PRODUCTION_HOST,
    key,
    keyLocation: `${PRODUCTION_ORIGIN}/${key}.txt`,
    urlList: normalizedUrls
  };
}

export function isNetlifyProductionDeploy(env = process.env, { isLocal = true } = {}) {
  return env.CONTEXT === 'production' && isLocal === false;
}

export async function readIndexNowKey(distDir, { readDirectory = readdir, readTextFile = readFile } = {}) {
  const entries = await readDirectory(distDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && /^[A-Za-z0-9-]{8,128}\.txt$/.test(entry.name))
    .map((entry) => entry.name.slice(0, -4))
    .sort();
  if (candidates.length !== 1) throw new Error(`expected exactly one IndexNow root key file, found ${candidates.length}`);
  const key = candidates[0];
  const content = await readTextFile(resolve(distDir, `${key}.txt`), 'utf8');
  if (content !== key) throw new Error('IndexNow root key file content must exactly equal its filename key');
  return key;
}

export async function changedFilesFromGit({ baseRef, headRef, cwd, execFileImpl = execFile }) {
  if (!baseRef || !headRef) return { reliable: false, changes: [], reason: 'missing COMMIT_REF or CACHED_COMMIT_REF' };
  if (baseRef === headRef) return { reliable: false, changes: [], reason: 'CACHED_COMMIT_REF equals COMMIT_REF' };
  try {
    const { stdout } = await execFileImpl('git', ['diff', '--name-status', '--diff-filter=ACMRD', baseRef, headRef], { cwd });
    return { reliable: true, changes: parseGitNameStatus(stdout), reason: null };
  } catch (error) {
    return { reliable: false, changes: [], reason: `unable to determine Git change set (${error.message})` };
  }
}

export function parseGitNameStatus(output) {
  if (typeof output !== 'string') throw new Error('Git name-status output must be a string');
  return output.split('\n').filter(Boolean).map((line) => {
    const fields = line.split('\t');
    const status = fields[0]?.charAt(0);
    if (!['A', 'C', 'M', 'R', 'D'].includes(status)) throw new Error(`unsupported Git change status: ${fields[0] || '(empty)'}`);
    if (status === 'R' || status === 'C') {
      if (fields.length !== 3 || !fields[1] || !fields[2]) throw new Error(`invalid ${status} name-status record`);
      return { status, beforePath: normalizedFile(fields[1]), afterPath: normalizedFile(fields[2]) };
    }
    if (fields.length !== 2 || !fields[1]) throw new Error(`invalid ${status} name-status record`);
    const path = normalizedFile(fields[1]);
    return { status, beforePath: status === 'A' ? null : path, afterPath: status === 'D' ? null : path };
  });
}

function normalizeChange(change) {
  if (typeof change === 'string') {
    const path = normalizedFile(change);
    return { status: 'M', beforePath: path, afterPath: path };
  }
  if (!change || typeof change !== 'object' || !['A', 'C', 'M', 'R', 'D'].includes(change.status)) {
    throw new Error('changed file must be a path or a supported Git change record');
  }
  return {
    status: change.status,
    beforePath: change.beforePath ? normalizedFile(change.beforePath) : null,
    afterPath: change.afterPath ? normalizedFile(change.afterPath) : null
  };
}

function changeDisplay(change) {
  if (change.status === 'R' || change.status === 'C') return `${change.status} ${change.beforePath} -> ${change.afterPath}`;
  return `${change.status} ${change.afterPath || change.beforePath}`;
}

function entityChangeKey(change) {
  return change.afterPath || change.beforePath;
}

function isPublishedEntity(record) {
  return record?.recordState === 'published';
}

async function readCurrentEntityRecord(path, { cwd, readTextFile }) {
  return JSON.parse(await readTextFile(resolve(cwd, path), 'utf8'));
}

async function readPriorEntityRecord(path, { baseRef, cwd, execFileImpl }) {
  const { stdout } = await execFileImpl('git', ['show', `${baseRef}:${path}`], { cwd });
  return JSON.parse(stdout);
}

export async function entityCandidatesForChanges(changes, { baseRef, cwd, readTextFile = readFile, execFileImpl = execFile } = {}) {
  const routesByFile = new Map();
  for (const rawChange of changes) {
    const change = normalizeChange(rawChange);
    const beforeStatePath = change.status === 'C' ? change.afterPath : change.beforePath;
    const beforeDirectory = beforeStatePath ? entityDirectoryForFile(beforeStatePath) : null;
    const afterDirectory = change.afterPath ? entityDirectoryForFile(change.afterPath) : null;
    if (!beforeDirectory && !afterDirectory) continue;

    const key = entityChangeKey(change);
    try {
      let beforeRecord = null;
      let afterRecord = null;
      if (change.status === 'M' || change.status === 'R' || change.status === 'D') {
        if (!baseRef || !change.beforePath) throw new Error('reliable prior Entity state is unavailable');
        beforeRecord = await readPriorEntityRecord(change.beforePath, { baseRef, cwd, execFileImpl });
      } else if (change.status === 'C' && beforeStatePath && baseRef) {
        try {
          beforeRecord = await readPriorEntityRecord(beforeStatePath, { baseRef, cwd, execFileImpl });
        } catch {
          // A copied path normally did not exist at base; that is a known false membership state.
        }
      }
      if (change.status !== 'D') {
        if (!change.afterPath) throw new Error('Entity change has no current path');
        afterRecord = await readCurrentEntityRecord(change.afterPath, { cwd, readTextFile });
      }

      const beforePublished = isPublishedEntity(beforeRecord);
      const afterPublished = isPublishedEntity(afterRecord);
      const candidates = [];
      if (beforePublished !== afterPublished) candidates.push(`${PRODUCTION_ORIGIN}/`);

      const beforeCollectionRoute = beforeDirectory ? ENTITY_DIRECTORY_ROUTES.get(beforeDirectory) : null;
      const afterCollectionRoute = afterDirectory ? ENTITY_DIRECTORY_ROUTES.get(afterDirectory) : null;
      if (beforePublished && beforeCollectionRoute) candidates.push(`${PRODUCTION_ORIGIN}${beforeCollectionRoute}`);
      if (afterPublished && afterCollectionRoute) {
        candidates.push(`${PRODUCTION_ORIGIN}${afterCollectionRoute}`);
        if (typeof afterRecord.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(afterRecord.slug)) {
          throw new Error('published Entity has no valid route identity');
        }
        candidates.push(`${PRODUCTION_ORIGIN}${afterCollectionRoute}/${afterRecord.slug}`);
      }
      routesByFile.set(key, candidates);
    } catch {
      // Undefined means the selector must conservatively fall back to the sitemap set.
    }
  }
  return routesByFile;
}

export async function prepareIndexNowNotification({ cwd, distDir, env = process.env, changedFiles, changes, readTextFile = readFile, execFileImpl = execFile }) {
  const [sitemapXml, key] = await Promise.all([
    readTextFile(resolve(distDir, 'sitemap.xml'), 'utf8'),
    readIndexNowKey(distDir, { readTextFile })
  ]);
  const allowlist = parseSitemapCanonicalUrls(sitemapXml);
  const refs = { baseRef: env.CACHED_COMMIT_REF || null, headRef: env.COMMIT_REF || null };
  let gitChangeSet;
  if (changes !== undefined) {
    gitChangeSet = { reliable: true, changes: changes.map(normalizeChange), reason: null };
  } else if (changedFiles !== undefined) {
    gitChangeSet = { reliable: true, changes: changedFiles.map(normalizeChange), reason: null };
  } else {
    gitChangeSet = await changedFilesFromGit({ ...refs, cwd, execFileImpl });
  }

  const selection = gitChangeSet.reliable
    ? selectChangedCanonicalUrls({
      changes: gitChangeSet.changes,
      allowlist,
      entityRoutesByFile: await entityCandidatesForChanges(gitChangeSet.changes, { ...refs, cwd, readTextFile, execFileImpl })
    })
    : {
      urls: [...allowlist],
      fallbackReason: `full canonical set: ${gitChangeSet.reason}`,
      changedFiles: []
    };
  const urlList = filterCanonicalAllowlist(selection.urls, allowlist);
  return {
    context: env.CONTEXT || 'local',
    refs,
    changedFiles: selection.changedFiles,
    allowlist,
    fallbackReason: selection.fallbackReason,
    urlList,
    payload: urlList.length > 0 ? buildIndexNowPayload({ key, urlList }) : null
  };
}

export async function submitIndexNow(payload, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (response.status === 200 || response.status === 202) return { status: response.status };
  const reason = {
    400: 'bad request',
    403: 'invalid or missing key file',
    422: 'URL, host, or key schema mismatch',
    429: 'rate limited'
  }[response.status] || 'unexpected response';
  const body = typeof response.text === 'function' ? (await response.text()).slice(0, 500) : '';
  throw new Error(`HTTP ${response.status} (${reason})${body ? `: ${body}` : ''}`);
}

export async function runIndexNowNotification({ cwd, distDir, env = process.env, isLocal = true, fetchImpl = globalThis.fetch, prepare = prepareIndexNowNotification }) {
  if (!isNetlifyProductionDeploy(env, { isLocal })) return { kind: 'skipped', reason: 'non-production or local deploy context; skipping submission' };
  try {
    const prepared = await prepare({ cwd, distDir, env });
    if (!prepared.payload) return { kind: 'skipped', reason: 'no production URL changes; skipping submission', prepared };
    const result = await submitIndexNow(prepared.payload, { fetchImpl });
    return { kind: 'submitted', status: result.status, urlCount: prepared.urlList.length, prepared };
  } catch (error) {
    return { kind: 'failed', error: error.message };
  }
}

function printDryRun(prepared) {
  console.log(`IndexNow dry run: context = ${prepared.context}`);
  console.log(`IndexNow dry run: base ref = ${prepared.refs.baseRef || '(unavailable)'}`);
  console.log(`IndexNow dry run: head ref = ${prepared.refs.headRef || '(unavailable)'}`);
  console.log(`IndexNow dry run: changed files = ${prepared.changedFiles.length ? prepared.changedFiles.join(', ') : '(unavailable or none)'}`);
  console.log(`IndexNow dry run: fallback = ${prepared.fallbackReason || 'none'}`);
  console.log(`IndexNow dry run: selected canonical URLs (${prepared.urlList.length})`);
  for (const url of prepared.urlList) console.log(`- ${url}`);
  console.log(`IndexNow dry run: payload URL count = ${prepared.payload?.urlList.length || 0}`);
}

async function main() {
  if (!process.argv.includes('--dry-run')) throw new Error('IndexNow notifications run only through Netlify onSuccess; use --dry-run for local inspection');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const prepared = await prepareIndexNowNotification({ cwd: root, distDir: resolve(root, 'dist') });
  printDryRun(prepared);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`IndexNow dry run failed: ${error.message}`);
    process.exitCode = 1;
  });
}

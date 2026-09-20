import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRODUCTION_ORIGIN,
  buildIndexNowPayload,
  changedFilesFromGit,
  entityCandidatesForChanges,
  filterCanonicalAllowlist,
  isNetlifyProductionDeploy,
  parseGitNameStatus,
  parseSitemapCanonicalUrls,
  runIndexNowNotification,
  selectChangedCanonicalUrls,
  submitIndexNow
} from '../scripts/indexnow.mjs';

const urls = [
  `${PRODUCTION_ORIGIN}/`,
  `${PRODUCTION_ORIGIN}/weapons`,
  `${PRODUCTION_ORIGIN}/weapons/white-shadow`,
  `${PRODUCTION_ORIGIN}/characters`,
  `${PRODUCTION_ORIGIN}/characters/soul`,
  `${PRODUCTION_ORIGIN}/guide`
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`;
const membershipUrls = [
  `${PRODUCTION_ORIGIN}/`,
  `${PRODUCTION_ORIGIN}/weapons`,
  `${PRODUCTION_ORIGIN}/weapons/new-published`,
  `${PRODUCTION_ORIGIN}/weapons/draft-to-published`,
  `${PRODUCTION_ORIGIN}/weapons/white-shadow`
];

function entity(recordState, slug) {
  return { recordState, slug };
}

async function selectEntityChange(change, { before, after, allowlist = membershipUrls }) {
  const currentRecords = new Map(after ? [[change.afterPath, after]] : []);
  const priorRecords = new Map(before ? [[change.beforePath, before]] : []);
  const readTextFile = async (path) => {
    const relative = String(path).replace('/repo/', '');
    if (!currentRecords.has(relative)) throw new Error(`missing current fixture: ${relative}`);
    return JSON.stringify(currentRecords.get(relative));
  };
  const execFileImpl = async (_command, args) => {
    const reference = args[1];
    const relative = reference.slice(reference.indexOf(':') + 1);
    if (!priorRecords.has(relative)) throw new Error(`missing prior fixture: ${relative}`);
    return { stdout: JSON.stringify(priorRecords.get(relative)) };
  };
  const entityRoutesByFile = await entityCandidatesForChanges([change], {
    baseRef: 'base',
    cwd: '/repo',
    readTextFile,
    execFileImpl
  });
  return selectChangedCanonicalUrls({ changes: [change], allowlist, entityRoutesByFile });
}

test('parses only strict production canonical URLs from the sitemap', () => {
  assert.deepEqual(parseSitemapCanonicalUrls(sitemap), urls);
  assert.throws(() => parseSitemapCanonicalUrls('<urlset><loc>https://preview.example.net/</loc></urlset>'), /production canonical/);
  assert.throws(() => parseSitemapCanonicalUrls('<urlset><loc>https://www.yingzhirenling.cn/weapons/</loc></urlset>'), /trailing-slash/);
});

test('draft Qinglong candidates, legacy HTML URLs, and invalid URLs are rejected by the sitemap allowlist', () => {
  assert.deepEqual(filterCanonicalAllowlist([
    `${PRODUCTION_ORIGIN}/weapons/qinglong-lueyue-dao`,
    `${PRODUCTION_ORIGIN}/weapons/white-shadow.html`,
    'http://localhost:4321/weapons/white-shadow',
    `${PRODUCTION_ORIGIN}/weapons/white-shadow`
  ], urls), [`${PRODUCTION_ORIGIN}/weapons/white-shadow`]);
});

test('docs-only changes submit no URLs', () => {
  const result = selectChangedCanonicalUrls({ changedFiles: ['docs/CURRENT-STATE.md', 'tests/indexnow.test.mjs', 'README.md'], allowlist: urls });
  assert.deepEqual(result.urls, []);
  assert.equal(result.fallbackReason, null);
});

test('Git name-status parsing retains deleted and renamed paths', async () => {
  const output = [
    'A\tdata/weapons/new-published.json',
    'M\tdata/weapons/white-shadow.json',
    'D\tdata/weapons/removed.json',
    'R100\tdata/weapons/old-name.json\tdata/weapons/new-name.json',
    'C100\tdata/weapons/source.json\tdata/weapons/copied.json'
  ].join('\n');
  assert.deepEqual(parseGitNameStatus(output), [
    { status: 'A', beforePath: null, afterPath: 'data/weapons/new-published.json' },
    { status: 'M', beforePath: 'data/weapons/white-shadow.json', afterPath: 'data/weapons/white-shadow.json' },
    { status: 'D', beforePath: 'data/weapons/removed.json', afterPath: null },
    { status: 'R', beforePath: 'data/weapons/old-name.json', afterPath: 'data/weapons/new-name.json' },
    { status: 'C', beforePath: 'data/weapons/source.json', afterPath: 'data/weapons/copied.json' }
  ]);
  const changeSet = await changedFilesFromGit({
    baseRef: 'base',
    headRef: 'head',
    cwd: '/repo',
    execFileImpl: async (_command, args) => {
      assert.deepEqual(args, ['diff', '--name-status', '--diff-filter=ACMRD', 'base', 'head']);
      return { stdout: output };
    }
  });
  assert.equal(changeSet.reliable, true);
  assert.deepEqual(changeSet.changes, parseGitNameStatus(output));
});

test('a shared BaseLayout change falls back to all current sitemap canonicals', () => {
  const result = selectChangedCanonicalUrls({ changedFiles: ['src/layouts/BaseLayout.astro'], allowlist: urls });
  assert.deepEqual(result.urls, urls);
  assert.match(result.fallbackReason, /full canonical set/);
});

test('a published Entity file maps deterministically to its collection and detail URL', () => {
  const result = selectChangedCanonicalUrls({
    changedFiles: ['data/weapons/white-shadow.json'],
    allowlist: urls,
    entityRoutesByFile: new Map([['data/weapons/white-shadow.json', [`${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/white-shadow`]]])
  });
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/white-shadow`]);
});

test('a draft Entity file has no production candidates', () => {
  const result = selectChangedCanonicalUrls({
    changedFiles: ['data/weapons/qinglong-lueyue-dao.json'],
    allowlist: urls,
    entityRoutesByFile: new Map([['data/weapons/qinglong-lueyue-dao.json', []]])
  });
  assert.deepEqual(result.urls, []);
});

test('new published Entity submits homepage, collection, and detail', async () => {
  const result = await selectEntityChange(
    { status: 'A', beforePath: null, afterPath: 'data/weapons/new-published.json' },
    { after: entity('published', 'new-published') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/`, `${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/new-published`]);
});

test('draft to published submits homepage, collection, and detail', async () => {
  const result = await selectEntityChange(
    { status: 'M', beforePath: 'data/weapons/draft-to-published.json', afterPath: 'data/weapons/draft-to-published.json' },
    { before: entity('draft', 'draft-to-published'), after: entity('published', 'draft-to-published') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/`, `${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/draft-to-published`]);
});

test('published to draft submits homepage and collection but no removed detail', async () => {
  const result = await selectEntityChange(
    { status: 'M', beforePath: 'data/weapons/white-shadow.json', afterPath: 'data/weapons/white-shadow.json' },
    { before: entity('published', 'white-shadow'), after: entity('draft', 'white-shadow') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/`, `${PRODUCTION_ORIGIN}/weapons`]);
  assert(!result.urls.includes(`${PRODUCTION_ORIGIN}/weapons/white-shadow`));
});

test('deleting a published Entity submits homepage and collection but no removed detail', async () => {
  const result = await selectEntityChange(
    { status: 'D', beforePath: 'data/weapons/white-shadow.json', afterPath: null },
    { before: entity('published', 'white-shadow') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/`, `${PRODUCTION_ORIGIN}/weapons`]);
  assert(!result.urls.includes(`${PRODUCTION_ORIGIN}/weapons/white-shadow`));
});

test('deleting a draft Entity submits no production URLs', async () => {
  const result = await selectEntityChange(
    { status: 'D', beforePath: 'data/weapons/qinglong-lueyue-dao.json', afterPath: null },
    { before: entity('draft', 'qinglong-lueyue-dao') }
  );
  assert.deepEqual(result.urls, []);
});

test('ordinary published Entity content update keeps collection and detail without homepage', async () => {
  const result = await selectEntityChange(
    { status: 'M', beforePath: 'data/weapons/white-shadow.json', afterPath: 'data/weapons/white-shadow.json' },
    { before: entity('published', 'white-shadow'), after: entity('published', 'white-shadow') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/white-shadow`]);
  assert(!result.urls.includes(`${PRODUCTION_ORIGIN}/`));
});

test('published Entity rename resolves old and new paths without duplicate canonical URLs', async () => {
  const result = await selectEntityChange(
    { status: 'R', beforePath: 'data/weapons/old-white-shadow.json', afterPath: 'data/weapons/white-shadow.json' },
    { before: entity('published', 'white-shadow'), after: entity('published', 'white-shadow') }
  );
  assert.deepEqual(result.urls, [`${PRODUCTION_ORIGIN}/weapons`, `${PRODUCTION_ORIGIN}/weapons/white-shadow`]);
});

test('docs-only deletion submits no URLs', () => {
  const result = selectChangedCanonicalUrls({
    changes: [{ status: 'D', beforePath: 'docs/old-note.md', afterPath: null }],
    allowlist: urls
  });
  assert.deepEqual(result.urls, []);
});

test('an unknown production-affecting source falls back to all canonical URLs', () => {
  const result = selectChangedCanonicalUrls({ changedFiles: ['src/unknown-production-source.mjs'], allowlist: urls });
  assert.deepEqual(result.urls, urls);
  assert.match(result.fallbackReason, /unmapped production-affecting/);
});

test('duplicate candidates are deduplicated before payload construction', () => {
  const candidates = [`${PRODUCTION_ORIGIN}/weapons/white-shadow`, `${PRODUCTION_ORIGIN}/weapons/white-shadow`, `${PRODUCTION_ORIGIN}/guide`];
  assert.deepEqual(filterCanonicalAllowlist(candidates, urls), [`${PRODUCTION_ORIGIN}/weapons/white-shadow`, `${PRODUCTION_ORIGIN}/guide`]);
  const payload = buildIndexNowPayload({ key: 'abcd1234-efgh5678', urlList: filterCanonicalAllowlist(candidates, urls) });
  assert.equal(payload.host, 'www.yingzhirenling.cn');
  assert.equal(payload.urlList.length, 2);
});

test('production is the only deployment context that can submit', async () => {
  const prepare = async () => ({ payload: { sample: true }, urlList: [urls[0]] });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 200, text: async () => '' };
  };
  for (const env of [
    { CONTEXT: 'deploy-preview' },
    { CONTEXT: 'branch-deploy' },
    { CONTEXT: 'dev' }
  ]) {
    const result = await runIndexNowNotification({ cwd: '.', distDir: '.', env, isLocal: false, fetchImpl, prepare });
    assert.equal(result.kind, 'skipped');
  }
  assert.equal(calls, 0);
  const localProduction = await runIndexNowNotification({ cwd: '.', distDir: '.', env: { CONTEXT: 'production' }, fetchImpl, prepare });
  assert.equal(localProduction.kind, 'skipped');
  assert.equal(isNetlifyProductionDeploy({ CONTEXT: 'production' }, { isLocal: false }), true);
  const result = await runIndexNowNotification({ cwd: '.', distDir: '.', env: { CONTEXT: 'production' }, isLocal: false, fetchImpl, prepare });
  assert.equal(result.kind, 'submitted');
  assert.equal(calls, 1);
});

test('an empty production change set skips the network request', async () => {
  let calls = 0;
  const result = await runIndexNowNotification({
    cwd: '.',
    distDir: '.',
    env: { CONTEXT: 'production' },
    isLocal: false,
    prepare: async () => ({ payload: null, urlList: [] }),
    fetchImpl: async () => {
      calls += 1;
      return { status: 200, text: async () => '' };
    }
  });
  assert.equal(result.kind, 'skipped');
  assert.match(result.reason, /no production URL changes/);
  assert.equal(calls, 0);
});

test('IndexNow HTTP failures are surfaced without throwing through the deploy hook', async () => {
  for (const [status, reason] of [[400, /bad request/], [403, /invalid or missing key/], [422, /schema mismatch/], [429, /rate limited/]]) {
    await assert.rejects(() => submitIndexNow({ host: 'www.yingzhirenling.cn' }, { fetchImpl: async () => ({ status, text: async () => 'rejected' }) }), reason);
  }
  const result = await runIndexNowNotification({
    cwd: '.',
    distDir: '.',
    env: { CONTEXT: 'production' },
    isLocal: false,
    prepare: async () => ({ payload: { host: 'www.yingzhirenling.cn' }, urlList: [urls[0]] }),
    fetchImpl: async () => ({ status: 429, text: async () => 'slow down' })
  });
  assert.equal(result.kind, 'failed');
  assert.match(result.error, /rate limited/);
});

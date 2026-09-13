import assert from 'node:assert/strict';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCallback);
const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts', 'validate-media.mjs');
const astroCli = resolve(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function bitmap(width = 1200, height = 750) {
  const buffer = Buffer.alloc(24);
  pngSignature.copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function mediaRecord(overrides = {}) {
  return {
    id: 'media:tang-hero',
    entityId: 'weapon:tang-hengdao',
    src: 'tang-hengdao.png',
    alt: '唐横刀的已审核媒体画面',
    caption: '审核用临时 fixture。',
    credit: 'Fixture rights holder',
    owner: 'Fixture rights holder',
    sourceUrl: 'https://example.com/media/tang-hengdao',
    sourceType: 'official-promotional',
    rightsStatus: 'official-press-use-reviewed',
    recordState: 'published',
    usage: ['hero'],
    width: 1200,
    height: 750,
    mimeType: 'image/png',
    retrievedAt: '2026-01-01',
    rightsEvidence: 'Temporary test fixture only.',
    processing: 'original',
    objectFit: 'cover',
    objectPosition: '50% 40%',
    ...overrides
  };
}

async function writeValidationFixture({ records = [], assets = [] }) {
  const fixture = await mkdtemp(join(tmpdir(), 'yingzhirenling-media-'));
  for (const directory of ['weapons', 'characters', 'bosses', 'locations', 'sources']) {
    await mkdir(join(fixture, 'data', directory), { recursive: true });
  }
  await writeFile(join(fixture, 'data', 'weapons', 'tang-hengdao.json'), JSON.stringify({ id: 'weapon:tang-hengdao', entityType: 'weapon', recordState: 'published' }));
  await writeFile(join(fixture, 'data', 'media.json'), JSON.stringify({ schemaVersion: '1.0-media-pilot', records }));
  if (assets.length > 0) {
    await mkdir(join(fixture, 'assets', 'media'), { recursive: true });
    await Promise.all(assets.map(({ name, contents = bitmap() }) => writeFile(join(fixture, 'assets', 'media', name), contents)));
  }
  return fixture;
}

async function validate(fixture) {
  const outputFile = join(fixture, 'validator-output.log');
  const output = await open(outputFile, 'w');
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [validator], {
        cwd: root,
        env: { ...process.env, MEDIA_VALIDATION_ROOT: fixture },
        stdio: ['ignore', output.fd, output.fd]
      });
      child.once('error', reject);
      child.once('close', resolve);
    });
    return { code, output: await readFile(outputFile, 'utf8') };
  } finally {
    await output.close();
  }
}

async function expectValidation(name, fixtureOptions, expectedCode, expectedText) {
  const fixture = await writeValidationFixture(fixtureOptions);
  try {
    const result = await validate(fixture);
    assert.equal(result.code, expectedCode, `${name}: unexpected validator exit\n${result.output}`);
    if (expectedText) {
      assert.match(result.output, expectedText, `${name}: expected validator diagnostic missing\n${result.output}`);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

const base = mediaRecord();
const riskAccepted = mediaRecord({ rightsStatus: 'official-promotional-risk-accepted' });
await expectValidation('zero Media remains valid', {}, 0);
await expectValidation('official press use reviewed remains valid', { records: [base], assets: [{ name: base.src }] }, 0);
await expectValidation('permission recorded remains valid', {
  records: [mediaRecord({ rightsStatus: 'permission-recorded' })], assets: [{ name: base.src }]
}, 0);
await expectValidation('self captured reviewed remains valid', {
  records: [mediaRecord({ rightsStatus: 'self-captured-reviewed' })], assets: [{ name: base.src }]
}, 0);
await expectValidation('official promotional risk accepted remains valid with complete provenance', {
  records: [riskAccepted], assets: [{ name: riskAccepted.src }]
}, 0);
for (const [field, overrides] of [
  ['alt', { alt: '' }],
  ['caption', { caption: null }],
  ['credit', { credit: '' }],
  ['owner', { owner: '' }],
  ['sourceUrl', { sourceUrl: '' }],
  ['sourceType', { sourceType: '' }],
  ['retrievedAt', { retrievedAt: 'not-a-date' }],
  ['rightsEvidence', { rightsEvidence: '' }],
  ['processing', { processing: '' }]
]) {
  await expectValidation(`risk accepted Media still requires ${field}`, {
    records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', ...overrides })], assets: [{ name: riskAccepted.src }]
  }, 1, new RegExp(`\\.${field}`));
}
await expectValidation('duplicate hero target is rejected', {
  records: [riskAccepted, mediaRecord({ id: 'media:tang-hero-duplicate', rightsStatus: 'official-promotional-risk-accepted' })],
  assets: [{ name: riskAccepted.src }]
}, 1, /重复的 production hero mapping/);
await expectValidation('duplicate card target is rejected', {
  records: [mediaRecord({ id: 'media:tang-card', rightsStatus: 'official-promotional-risk-accepted', usage: ['card'] }), mediaRecord({ id: 'media:tang-card-duplicate', rightsStatus: 'official-promotional-risk-accepted', usage: ['card'] })],
  assets: [{ name: riskAccepted.src }]
}, 1, /重复的 production card mapping/);
await expectValidation('unsupported production usage is rejected', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', usage: ['gallery'] })],
  assets: [{ name: riskAccepted.src }]
}, 1, /当前仅可使用已渲染的 hero 或 card usage/);
await expectValidation('future usage remains valid outside production', {
  records: [mediaRecord({ id: 'media:tang-gallery-draft', recordState: 'draft', rightsStatus: 'review-required', usage: ['gallery'] })],
  assets: [{ name: base.src }]
}, 0);
await expectValidation('review required remains production ineligible', {
  records: [mediaRecord({ rightsStatus: 'review-required' })], assets: [{ name: base.src }]
}, 1, /published Media 必须具有 production-eligible rightsStatus/);
await expectValidation('do not use remains production ineligible', {
  records: [mediaRecord({ rightsStatus: 'do-not-use' })], assets: [{ name: base.src }]
}, 1, /published Media 必须具有 production-eligible rightsStatus/);
await expectValidation('unsafe objectPosition is rejected', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', objectPosition: 'center; background:url(https://invalid.example)' })],
  assets: [{ name: riskAccepted.src }]
}, 1, /objectPosition/);
await expectValidation('portrait Weapon hero is accepted by the rendered-slot rule', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', width: 640, height: 900 })],
  assets: [{ name: riskAccepted.src, contents: bitmap(640, 900) }]
}, 0);
await expectValidation('overwide risk accepted hero is rejected by the rendered-slot rule', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', width: 1204, height: 400 })],
  assets: [{ name: riskAccepted.src, contents: bitmap(1204, 400) }]
}, 1, /hero 必须至少为 640×360/);
await expectValidation('undersized card is rejected by the rendered-slot rule', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', usage: ['card'], width: 300, height: 180 })],
  assets: [{ name: riskAccepted.src, contents: bitmap(300, 180) }]
}, 1, /card 必须至少为 320×180/);
await expectValidation('overportrait risk accepted card is rejected by the rendered-slot rule', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', usage: ['card'], width: 320, height: 700 })],
  assets: [{ name: riskAccepted.src, contents: bitmap(320, 700) }]
}, 1, /card 必须至少为 320×180/);
await expectValidation('missing risk accepted file is rejected', { records: [riskAccepted] }, 1, /本地资源不存在/);
await expectValidation('MIME mismatch is rejected', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', src: 'tang-hengdao.jpg', mimeType: 'image/jpeg' })],
  assets: [{ name: 'tang-hengdao.jpg' }]
}, 1, /与文件编码不符/);
await expectValidation('dimension mismatch is rejected', {
  records: [mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', width: 1199 })],
  assets: [{ name: riskAccepted.src }]
}, 1, /与文件尺寸不符/);
await expectValidation('unrecognized risk accepted image signature is rejected', {
  records: [riskAccepted], assets: [{ name: riskAccepted.src, contents: Buffer.from('not an image') }]
}, 1, /图像签名无法识别或不受支持/);
await expectValidation('orphan production bitmap is rejected', {
  assets: [{ name: 'orphan.png' }]
}, 1, /生产位图必须由 data\/media\.json 中的 Media record 表示/);

const fixtureParent = await mkdtemp(join(tmpdir(), 'yingzhirenling-media-render-'));
const fixture = join(fixtureParent, 'site');
try {
  await cp(root, fixture, {
    recursive: true,
    filter(source) {
      const relativeSource = relative(root, source);
      const firstSegment = relativeSource.split(sep)[0];
      const productionMediaDirectory = join('assets', 'media');
      const isProductionMedia = relativeSource === productionMediaDirectory || relativeSource.startsWith(`${productionMediaDirectory}${sep}`);
      return !['.git', 'node_modules', 'dist'].includes(firstSegment) && !isProductionMedia;
    }
  });
  await symlink(resolve(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
  const admitted = mediaRecord({ rightsStatus: 'official-promotional-risk-accepted', usage: ['hero', 'card'] });
  const draft = mediaRecord({
    id: 'media:ya-card-review',
    entityId: 'weapon:ya-hengdao',
    src: 'ya-hengdao-review.png',
    rightsStatus: 'review-required',
    recordState: 'draft',
    usage: ['card']
  });
  const doNotUse = mediaRecord({
    id: 'media:ya-card-do-not-use',
    entityId: 'weapon:ya-hengdao',
    src: 'ya-hengdao-do-not-use.png',
    rightsStatus: 'do-not-use',
    recordState: 'draft',
    usage: ['card']
  });
  await mkdir(join(fixture, 'assets', 'media'), { recursive: true });
  await Promise.all([
    writeFile(join(fixture, 'data', 'media.json'), JSON.stringify({ schemaVersion: '1.0-media-pilot', records: [admitted, draft, doNotUse] })),
    writeFile(join(fixture, 'assets', 'media', admitted.src), bitmap()),
    writeFile(join(fixture, 'assets', 'media', draft.src), bitmap()),
    writeFile(join(fixture, 'assets', 'media', doNotUse.src), bitmap())
  ]);
  const validation = await validate(fixture);
  assert.equal(validation.code, 0, `render fixture validation failed\n${validation.output}`);
  await execFile(process.execPath, [astroCli, 'build'], { cwd: fixture });
  await execFile(process.execPath, ['scripts/astro/copy-legacy-static.mjs'], { cwd: fixture });

  const detail = await readFile(join(fixture, 'dist', 'weapons', 'tang-hengdao.html'), 'utf8');
  const collection = await readFile(join(fixture, 'dist', 'weapons.html'), 'utf8');
  assert(detail.includes('data-media-state="ready"'), 'admitted hero Media must render ready state');
  assert(detail.includes(`src="/assets/media/${admitted.src}"`), 'admitted hero Media src must be static HTML');
  assert(detail.includes(`alt="${admitted.alt}"`), 'admitted hero Media alt must be static HTML');
  assert(detail.includes(`width="${admitted.width}"`) && detail.includes(`height="${admitted.height}"`), 'admitted hero Media must emit intrinsic dimensions');
  assert(detail.includes(`<a href="${admitted.sourceUrl}" target="_blank" rel="noopener noreferrer">查看媒体来源</a>`), 'detail hero must retain its media source link');
  const cardFigure = collection.match(new RegExp('<figure class="entity-media entity-media--card"[\\s\\S]*?</figure>'))?.[0];
  assert(cardFigure, 'collection cards must use card Media mode');
  assert(!cardFigure.includes('<a '), 'card Media must not create a nested source anchor');
  assert(!cardFigure.includes('entity-media__caption'), 'card Media must not render caption, credit, or source presentation');
  const tangCardStart = collection.indexOf('href="/weapons/tang-hengdao"');
  const tangCard = collection.slice(tangCardStart, collection.indexOf('</a>', tangCardStart));
  assert(tangCard.includes(`src="/assets/media/${admitted.src}"`), 'admitted card Media must render in its Entity card');
  assert(!tangCard.match(/<figure[\s\S]*?<\/figure>/)?.[0].includes('<a '), 'admitted card Media must not create a nested source anchor');
  assert(!tangCard.match(/<figure[\s\S]*?<\/figure>/)?.[0].includes('entity-media__caption'), 'admitted card Media must not render caption, credit, or source presentation');
  const yaCardStart = collection.indexOf('href="/weapons/ya-hengdao"');
  const yaCard = collection.slice(yaCardStart, collection.indexOf('</a>', yaCardStart));
  assert(yaCard.includes('data-media-state="fallback"'), 'draft/review-required/do-not-use card Media must leave its Entity fallback intact');
  assert(!collection.includes(draft.src), 'draft/review-required Media src must not project into collection HTML');
  assert(!collection.includes(doNotUse.src), 'draft/do-not-use Media src must not project into collection HTML');
  await readFile(join(fixture, 'dist', 'assets', 'media', admitted.src));
  await assert.rejects(() => readFile(join(fixture, 'dist', 'assets', 'media', draft.src)), { code: 'ENOENT' });
  await assert.rejects(() => readFile(join(fixture, 'dist', 'assets', 'media', doNotUse.src)), { code: 'ENOENT' });
} finally {
  await rm(fixtureParent, { recursive: true, force: true });
}

console.log('Media regression tests passed: validator gates, static projection, copy isolation, detail source links, and card anchor safety.');

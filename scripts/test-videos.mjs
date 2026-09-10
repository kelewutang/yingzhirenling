import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { getVideoUrls } from '../src/lib/video.mjs';

const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts', 'validate-videos.mjs');

function videoRecord(overrides = {}) {
  return {
    id: 'video:state-of-play-deep-dive',
    recordState: 'published',
    title: 'Fixture State of Play 深度实机',
    description: '只用于验证 Video contract 的测试记录。',
    platform: 'bilibili',
    platformVideoId: 'BV1Zdbi6rER9',
    sourceUrl: 'https://www.bilibili.com/video/BV1Zdbi6rER9/',
    owner: 'Fixture official publisher',
    sourceType: 'official-promotional',
    rightsStatus: 'official-promotional-risk-accepted',
    rightsEvidence: 'Temporary test fixture only; provenance and risk review are simulated.',
    retrievedAt: '2026-08-26',
    publishedAt: '2026-08-18',
    kind: 'showcase',
    relatedEntityIds: ['character:soul'],
    ...overrides
  };
}

async function writeValidationFixture(records, entityRecords = [{ id: 'character:soul', recordState: 'published' }]) {
  const fixture = await mkdtemp(join(tmpdir(), 'yingzhirenling-videos-'));
  for (const directory of ['weapons', 'characters', 'bosses', 'locations']) {
    await mkdir(join(fixture, 'data', directory), { recursive: true });
  }
  await Promise.all(entityRecords.map((entity, index) => writeFile(join(fixture, 'data', 'characters', `fixture-${index}.json`), JSON.stringify(entity))));
  await writeFile(join(fixture, 'data', 'videos.json'), JSON.stringify({ schemaVersion: '1.0-video', records }));
  return fixture;
}

async function validate(fixture) {
  const outputFile = join(fixture, 'validator-output.log');
  const output = await open(outputFile, 'w');
  try {
    const code = await new Promise((resolveCode, reject) => {
      const child = spawn(process.execPath, [validator], {
        cwd: root,
        env: { ...process.env, VIDEO_VALIDATION_ROOT: fixture },
        stdio: ['ignore', output.fd, output.fd]
      });
      child.once('error', reject);
      child.once('close', resolveCode);
    });
    return { code, output: await readFile(outputFile, 'utf8') };
  } finally {
    await output.close();
  }
}

async function expectValidation(name, records, expectedCode, expectedText, entityRecords) {
  const fixture = await writeValidationFixture(records, entityRecords);
  try {
    const result = await validate(fixture);
    assert.equal(result.code, expectedCode, `${name}: unexpected validator exit\n${result.output}`);
    if (expectedText) assert.match(result.output, expectedText, `${name}: expected validator diagnostic missing\n${result.output}`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

const bilibili = videoRecord();
const youtube = videoRecord({
  id: 'video:summer-game-fest-gameplay',
  recordState: 'draft',
  platform: 'youtube',
  platformVideoId: 'mOncuUWLipQ',
  sourceUrl: 'https://www.youtube.com/watch?v=mOncuUWLipQ',
  sourceType: 'official-channel',
  rightsStatus: 'review-required',
  publishedAt: null,
  kind: 'trailer',
  relatedEntityIds: undefined
});

assert.deepEqual(getVideoUrls('bilibili', bilibili.platformVideoId), {
  sourceUrl: bilibili.sourceUrl,
  embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1Zdbi6rER9&page=1&high_quality=1&danmaku=0'
});
assert.deepEqual(getVideoUrls('youtube', youtube.platformVideoId), {
  sourceUrl: youtube.sourceUrl,
  embedUrl: 'https://www.youtube.com/embed/mOncuUWLipQ'
});
for (const bvid of ['BV1Zdbi6rER9', 'BV1Hmuv68EWW', 'BV1VtVr6GE5H', 'BV1VVM166Evb']) {
  assert.equal(getVideoUrls('bilibili', bvid).sourceUrl, `https://www.bilibili.com/video/${bvid}/`);
}
for (const videoId of ['csuFGspAe6s', 'mOncuUWLipQ']) {
  assert.equal(getVideoUrls('youtube', videoId).sourceUrl, `https://www.youtube.com/watch?v=${videoId}`);
}
assert.throws(() => getVideoUrls('youtube', 'not-a-video-id'));

await expectValidation('empty production dataset remains valid', [], 0);
await expectValidation('published Video can reference a published Entity', [bilibili], 0);
await expectValidation('valid Bilibili and YouTube records pass', [bilibili, youtube], 0);
await expectValidation('missing required title is rejected', [videoRecord({ title: undefined })], 1, /\.title/);
await expectValidation('duplicate video IDs are rejected', [bilibili, videoRecord({ title: 'Duplicate fixture' })], 1, /重复 ID/);
await expectValidation('different internal IDs cannot duplicate one platform video', [bilibili, videoRecord({ id: 'video:state-of-play-deep-dive-duplicate', title: 'Different internal ID fixture' })], 1, /重复的平台视频 identity/);
await expectValidation('unsupported platform is rejected', [videoRecord({ platform: 'vimeo' })], 1, /\.platform/);
await expectValidation('malformed Bilibili BV ID is rejected', [videoRecord({ platformVideoId: 'BV1bad' })], 1, /\.platformVideoId/);
await expectValidation('malformed YouTube ID is rejected', [videoRecord({ platform: 'youtube', platformVideoId: 'too-short', sourceUrl: 'https://www.youtube.com/watch?v=too-short' })], 1, /\.platformVideoId/);
await expectValidation('platform source mismatch is rejected', [videoRecord({ sourceUrl: 'https://www.youtube.com/watch?v=csuFGspAe6s' })], 1, /\.sourceUrl/);
await expectValidation('canonical source URL with extra query is rejected', [videoRecord({ sourceUrl: 'https://www.bilibili.com/video/BV1Zdbi6rER9/?utm=fixture' })], 1, /\.sourceUrl/);
await expectValidation('canonical source URL with fragment is rejected', [videoRecord({ sourceUrl: 'https://www.bilibili.com/video/BV1Zdbi6rER9/#fixture' })], 1, /\.sourceUrl/);
await expectValidation('mixed-case canonical host is rejected', [{ ...youtube, sourceUrl: 'https://WWW.YouTube.com/watch?v=mOncuUWLipQ' }], 1, /\.sourceUrl/);
await expectValidation('explicit default HTTPS port is rejected', [{ ...youtube, sourceUrl: 'https://www.youtube.com:443/watch?v=mOncuUWLipQ' }], 1, /\.sourceUrl/);
await expectValidation('non HTTPS source URL is rejected', [videoRecord({ sourceUrl: 'http://www.bilibili.com/video/BV1Zdbi6rER9/' })], 1, /\.sourceUrl/);
await expectValidation('unsupported source host is rejected', [videoRecord({ sourceUrl: 'https://evil.example/video/BV1Zdbi6rER9/' })], 1, /\.sourceUrl/);
await expectValidation('dangerous source URL scheme is rejected', [videoRecord({ sourceUrl: 'javascript:alert(1)' })], 1, /\.sourceUrl/);
await expectValidation('unknown record state is rejected', [videoRecord({ recordState: 'archived' })], 1, /\.recordState/);
await expectValidation('unknown source type is rejected', [videoRecord({ sourceType: 'unknown' })], 1, /\.sourceType/);
await expectValidation('unknown rights status is rejected', [videoRecord({ rightsStatus: 'unknown' })], 1, /\.rightsStatus/);
await expectValidation('published review-required record is rejected', [videoRecord({ rightsStatus: 'review-required' })], 1, /production-eligible/);
await expectValidation('published do-not-use record is rejected', [videoRecord({ rightsStatus: 'do-not-use' })], 1, /production-eligible/);
await expectValidation('risk accepted record requires official promotional provenance', [videoRecord({ sourceType: 'official-channel' })], 1, /official-promotional-risk-accepted/);
await expectValidation('malformed retrieved date is rejected', [videoRecord({ retrievedAt: '2026-13-01' })], 1, /\.retrievedAt/);
await expectValidation('malformed published date is rejected', [videoRecord({ publishedAt: 'not-a-date' })], 1, /\.publishedAt/);
await expectValidation('duplicate related Entity IDs are rejected', [videoRecord({ relatedEntityIds: ['character:soul', 'character:soul'] })], 1, /重复 Entity ID/);
await expectValidation('unknown related Entity reference is rejected', [videoRecord({ relatedEntityIds: ['character:not-real'] })], 1, /Entity 不存在/);
await expectValidation('published Video cannot reference a draft Entity', [videoRecord({ relatedEntityIds: ['character:draft'] })], 1, /published Video 只能引用 published Entity/, [
  { id: 'character:soul', recordState: 'published' },
  { id: 'character:draft', recordState: 'draft' }
]);
await expectValidation('arbitrary embed HTML is rejected', [videoRecord({ embedHtml: '<iframe src="https://evil.example"></iframe>' })], 1, /不接受任意 embed HTML/);
await expectValidation('arbitrary embed URL is rejected', [videoRecord({ embedUrl: 'data:text/html,unsafe' })], 1, /不接受任意 embed HTML/);

console.log('Video regression tests passed: platform ID/URL derivation and production eligibility contract gates.');

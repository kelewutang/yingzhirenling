import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMatchingVideoSourceUrl, isValidPlatformVideoId, videoPlatforms } from '../src/lib/video.mjs';

const root = process.env.VIDEO_VALIDATION_ROOT
  ? path.resolve(process.env.VIDEO_VALIDATION_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const videoFile = path.join(root, 'data', 'videos.json');
const entityDirectories = ['weapons', 'characters', 'bosses', 'locations'];
const videoSchemaVersion = '1.0-video';
const recordStates = new Set(['draft', 'published', 'retired']);
const sourceTypes = new Set(['official-promotional', 'official-channel', 'self-captured', 'third-party-permitted']);
const rightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'official-promotional-risk-accepted',
  'review-required',
  'do-not-use'
]);
const productionRightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'official-promotional-risk-accepted'
]);
const kinds = new Set(['gameplay', 'trailer', 'showcase']);
const idPattern = /^video:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedFields = new Set([
  'id', 'recordState', 'title', 'description', 'platform', 'platformVideoId', 'sourceUrl',
  'owner', 'sourceType', 'rightsStatus', 'rightsEvidence', 'retrievedAt', 'publishedAt',
  'kind', 'relatedEntityIds'
]);
const errors = [];

function error(location, message) {
  errors.push(`${location}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function recordsIn(directory) {
  try {
    const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
    return Promise.all(names.map(async (name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))));
  } catch (cause) {
    error(path.relative(root, directory).replaceAll('\\', '/'), `无法读取 Entity 数据：${cause.message}`);
    return [];
  }
}

const [entityGroups, document] = await Promise.all([
  Promise.all(entityDirectories.map((directory) => recordsIn(path.join(root, 'data', directory)))),
  fs.readFile(videoFile, 'utf8').then(JSON.parse).catch((cause) => {
    error('data/videos.json', `JSON 无法解析：${cause.message}`);
    return null;
  })
]);
const entityById = new Map(entityGroups.flat().map((entity) => [entity.id, entity]));

if (!isObject(document)) {
  error('data/videos.json', '必须是对象');
} else {
  if (document.schemaVersion !== videoSchemaVersion) error('data/videos.json.schemaVersion', `必须为 ${videoSchemaVersion}`);
  if (!Array.isArray(document.records)) {
    error('data/videos.json.records', '必须是数组');
  } else {
    const ids = new Set();
    const platformVideoIdentities = new Map();
    for (const [index, video] of document.records.entries()) {
      const location = `data/videos.json.records[${index}]`;
      if (!isObject(video)) {
        error(location, '必须是对象');
        continue;
      }
      for (const field of Object.keys(video)) {
        if (!allowedFields.has(field)) {
          error(`${location}.${field}`, field === 'embedHtml' || field === 'embedUrl'
            ? '不接受任意 embed HTML 或 URL；embed/navigation URL 必须从经过验证的平台和 ID 派生'
            : '不是 Video V1 支持的字段');
        }
      }
      if (typeof video.id !== 'string' || !idPattern.test(video.id)) error(`${location}.id`, '必须是稳定的 video: kebab-case ID');
      else if (ids.has(video.id)) error(`${location}.id`, `重复 ID：${video.id}`);
      else ids.add(video.id);
      if (!recordStates.has(video.recordState)) error(`${location}.recordState`, '必须为 draft、published 或 retired');
      if (typeof video.title !== 'string' || !video.title.trim()) error(`${location}.title`, '必须是非空字符串');
      if (typeof video.description !== 'string' || !video.description.trim()) error(`${location}.description`, '必须是非空字符串');
      if (!videoPlatforms.has(video.platform)) error(`${location}.platform`, '必须为受支持的平台：bilibili 或 youtube');
      if (!isValidPlatformVideoId(video.platform, video.platformVideoId)) error(`${location}.platformVideoId`, '不符合声明平台的受支持 ID 格式');
      if (videoPlatforms.has(video.platform) && isValidPlatformVideoId(video.platform, video.platformVideoId)) {
        const platformVideoIdentity = `${video.platform}:${video.platformVideoId}`;
        const first = platformVideoIdentities.get(platformVideoIdentity);
        if (first !== undefined) error(`${location}.platformVideoId`, `与 records[${first}] 重复的平台视频 identity：${platformVideoIdentity}`);
        else platformVideoIdentities.set(platformVideoIdentity, index);
      }
      if (!isMatchingVideoSourceUrl(video.platform, video.platformVideoId, video.sourceUrl)) error(`${location}.sourceUrl`, '必须是与声明平台和 platformVideoId 精确匹配的 HTTPS 规范导航 URL');
      if (typeof video.owner !== 'string' || !video.owner.trim()) error(`${location}.owner`, '必须记录发布者或权利主体上下文');
      if (!sourceTypes.has(video.sourceType)) error(`${location}.sourceType`, '必须是受支持的视频来源类型');
      if (!rightsStatuses.has(video.rightsStatus)) error(`${location}.rightsStatus`, '必须是 Video rightsStatus 词表中的值');
      if (typeof video.rightsEvidence !== 'string' || !video.rightsEvidence.trim()) error(`${location}.rightsEvidence`, '必须记录审核依据');
      if (!isDate(video.retrievedAt)) error(`${location}.retrievedAt`, '必须是合法的 YYYY-MM-DD 日期');
      if (video.publishedAt !== null && !isDate(video.publishedAt)) error(`${location}.publishedAt`, '必须是合法的 YYYY-MM-DD 日期或 null');
      if (video.recordState === 'published' && video.publishedAt === null) error(`${location}.publishedAt`, 'published Video 必须记录平台发布日期');
      if (isDate(video.publishedAt) && isDate(video.retrievedAt) && video.publishedAt > video.retrievedAt) error(`${location}.publishedAt`, '不得晚于 retrievedAt');
      if (!kinds.has(video.kind)) error(`${location}.kind`, '必须为 gameplay、trailer 或 showcase');
      if (video.recordState === 'published' && !productionRightsStatuses.has(video.rightsStatus)) error(`${location}.rightsStatus`, 'published Video 必须具有 production-eligible rightsStatus；review-required、do-not-use 和 unknown 均不得进入 production');
      if (video.rightsStatus === 'official-promotional-risk-accepted' && video.sourceType !== 'official-promotional') error(`${location}.sourceType`, 'official-promotional-risk-accepted 只适用于可追溯的官方开发商或发行商宣传材料');
      if (video.relatedEntityIds !== undefined) {
        if (!Array.isArray(video.relatedEntityIds) || video.relatedEntityIds.some((id) => typeof id !== 'string' || !id)) {
          error(`${location}.relatedEntityIds`, '如提供必须是 Entity ID 字符串数组');
        } else {
          if (new Set(video.relatedEntityIds).size !== video.relatedEntityIds.length) error(`${location}.relatedEntityIds`, '不得包含重复 Entity ID');
          for (const entityId of video.relatedEntityIds) {
            const entity = entityById.get(entityId);
            if (!entity) error(`${location}.relatedEntityIds`, `Entity 不存在：${entityId}`);
            else if (video.recordState === 'published' && entity.recordState !== 'published') error(`${location}.relatedEntityIds`, `published Video 只能引用 published Entity：${entityId}`);
          }
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`Video validation failed with ${errors.length} error(s):`);
  for (const item of errors) console.error(`- ${item}`);
  process.exitCode = 1;
} else {
  const records = document?.records || [];
  const productionCount = records.filter((record) => record?.recordState === 'published' && productionRightsStatuses.has(record.rightsStatus)).length;
  console.log(`Video validation passed: ${records.length} record(s), ${productionCount} production-eligible record(s).`);
}

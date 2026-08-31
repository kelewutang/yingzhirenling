import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaFile = path.join(root, 'data', 'media.json');
const assetsDirectory = path.join(root, 'assets', 'media');
const entityDirectories = ['weapons', 'characters', 'bosses', 'locations'];
const sourceDirectory = path.join(root, 'data', 'sources');
const mediaSchemaVersion = '1.0-media-pilot';
const recordStates = new Set(['draft', 'published', 'retired']);
const rightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'review-required',
  'do-not-use'
]);
const productionRightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed'
]);
const sourceTypes = new Set(['official-promotional', 'press-asset', 'self-captured', 'third-party-permitted']);
const usages = new Set(['hero', 'card', 'gallery', 'inline', 'thumbnail']);
const mimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);
const idPattern = /^media:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const filenamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png|webp)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const errors = [];

function error(location, message) {
  errors.push(`${location}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function imageInfo(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const type = buffer.subarray(12, 16).toString('ascii');
    if (type === 'VP8 ' && buffer.length >= 30) return { mimeType: 'image/webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (type === 'VP8L' && buffer.length >= 25) {
      const value = buffer.readUInt32LE(21);
      return { mimeType: 'image/webp', width: (value & 0x3fff) + 1, height: ((value >> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8X' && buffer.length >= 30) return { mimeType: 'image/webp', width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { mimeType: 'image/jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function recordsIn(directory) {
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))));
}

const [entityGroups, sources, document] = await Promise.all([
  Promise.all(entityDirectories.map((directory) => recordsIn(path.join(root, 'data', directory)))),
  recordsIn(sourceDirectory),
  fs.readFile(mediaFile, 'utf8').then(JSON.parse).catch((cause) => {
    error('data/media.json', `JSON 无法解析：${cause.message}`);
    return null;
  })
]);
const entityIds = new Set(entityGroups.flat().map((entity) => entity.id));
const sourceIds = new Set(sources.map((source) => source.id));

if (!isObject(document)) {
  error('data/media.json', '必须是对象');
} else {
  if (document.schemaVersion !== mediaSchemaVersion) error('data/media.json.schemaVersion', `必须为 ${mediaSchemaVersion}`);
  if (!Array.isArray(document.records)) {
    error('data/media.json.records', '必须是数组');
  } else {
    const ids = new Set();
    for (const [index, media] of document.records.entries()) {
      const location = `data/media.json.records[${index}]`;
      if (!isObject(media)) {
        error(location, '必须是对象');
        continue;
      }
      if (typeof media.id !== 'string' || !idPattern.test(media.id)) error(`${location}.id`, '必须是稳定的 media: kebab-case ID');
      else if (ids.has(media.id)) error(`${location}.id`, `重复 ID：${media.id}`);
      else ids.add(media.id);
      if (typeof media.entityId !== 'string' || !entityIds.has(media.entityId)) error(`${location}.entityId`, '必须引用存在的 Entity');
      if (typeof media.src !== 'string' || !filenamePattern.test(media.src)) error(`${location}.src`, '必须是 assets/media 下的小写 ASCII 图像文件名');
      if (typeof media.alt !== 'string' || !media.alt.trim()) error(`${location}.alt`, 'Hero 媒体必须提供非空、描述画面的 alt');
      if (typeof media.caption !== 'string') error(`${location}.caption`, '必须是字符串');
      if (typeof media.credit !== 'string' || !media.credit.trim()) error(`${location}.credit`, '必须提供 credit');
      if (typeof media.owner !== 'string' || !media.owner.trim()) error(`${location}.owner`, '必须记录权利主体或发布方');
      if (media.sourceId !== undefined && (typeof media.sourceId !== 'string' || !sourceIds.has(media.sourceId))) error(`${location}.sourceId`, '如提供必须引用存在的 Source');
      if (!isHttpUrl(media.sourceUrl)) error(`${location}.sourceUrl`, '必须是合法的 HTTP(S) URL');
      if (!sourceTypes.has(media.sourceType)) error(`${location}.sourceType`, '必须是受支持的媒体来源类型');
      if (!rightsStatuses.has(media.rightsStatus)) error(`${location}.rightsStatus`, '必须是 Media Source Policy 定义的 rightsStatus');
      if (!recordStates.has(media.recordState)) error(`${location}.recordState`, '必须为 draft、published 或 retired');
      if (!Array.isArray(media.usage) || media.usage.length === 0 || media.usage.some((usage) => !usages.has(usage)) || new Set(media.usage).size !== media.usage.length) error(`${location}.usage`, '必须是唯一、受支持的 usage 数组');
      if (!Number.isInteger(media.width) || media.width < 1 || !Number.isInteger(media.height) || media.height < 1) error(`${location}.width/height`, '必须是正整数');
      if (!mimeTypes.has(media.mimeType)) error(`${location}.mimeType`, '必须是支持的本地图像 MIME type');
      if (!isDate(media.retrievedAt)) error(`${location}.retrievedAt`, '必须是合法的 YYYY-MM-DD 日期');
      if (typeof media.rightsEvidence !== 'string' || !media.rightsEvidence.trim()) error(`${location}.rightsEvidence`, '必须记录审核依据');
      if (typeof media.processing !== 'string' || !media.processing.trim()) error(`${location}.processing`, '必须记录处理过程；未处理时写明 original');
      if (media.objectFit !== 'cover' && media.objectFit !== 'contain') error(`${location}.objectFit`, '必须为 cover 或 contain');
      if (media.objectPosition !== undefined && (typeof media.objectPosition !== 'string' || !media.objectPosition.trim())) error(`${location}.objectPosition`, '如提供必须是非空字符串');
      if (media.recordState === 'published' && !productionRightsStatuses.has(media.rightsStatus)) error(`${location}.rightsStatus`, 'published Media 必须具有 production-eligible rightsStatus；review-required、do-not-use 和 unknown 均不得渲染');
      if (typeof media.src !== 'string' || !filenamePattern.test(media.src) || !mimeTypes.has(media.mimeType)) continue;
      const assetPath = path.join(assetsDirectory, media.src);
      try {
        const buffer = await fs.readFile(assetPath);
        const info = imageInfo(buffer);
        if (!info) error(`${location}.src`, '图像签名无法识别或不受支持');
        else {
          if (info.mimeType !== media.mimeType) error(`${location}.mimeType`, `与文件编码不符：检测到 ${info.mimeType}`);
          if (info.width !== media.width || info.height !== media.height) error(`${location}.width/height`, `与文件尺寸不符：检测到 ${info.width}x${info.height}`);
        }
        if (path.extname(media.src).slice(1) !== mimeTypes.get(media.mimeType)) error(`${location}.src`, '文件扩展名与 mimeType 不符');
        if (media.recordState === 'published' && buffer.byteLength > 650 * 1024) error(`${location}.src`, 'published Hero 资源超过当前 650 KB 初始预算');
      } catch {
        error(`${location}.src`, `本地资源不存在：assets/media/${media.src}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Media validation failed with ${errors.length} error(s):`);
  for (const item of errors) console.error(`- ${item}`);
  process.exitCode = 1;
} else {
  console.log(`Media validation passed: ${document.records.length} record(s), ${document.records.filter((item) => item.recordState === 'published').length} production-eligible record(s).`);
}

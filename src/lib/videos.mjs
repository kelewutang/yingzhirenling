import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getVideoUrls, isProductionEligibleVideo } from './video.mjs';

const videoFile = resolve(process.cwd(), 'data/videos.json');
const platformLabels = { bilibili: 'Bilibili', youtube: 'YouTube' };
const kindLabels = { gameplay: '实机', trailer: '预告', showcase: '专场' };
let cached;

function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

export async function loadPublishedVideos() {
  cached ??= readFile(videoFile, 'utf8').then(JSON.parse).then((document) => document.records
    .filter(isProductionEligibleVideo)
    .map((record) => {
      const urls = getVideoUrls(record.platform, record.platformVideoId);
      if (record.sourceUrl !== urls.sourceUrl) throw new Error(`Video source URL is not canonical: ${record.id}`);
      return {
        id: record.id,
        title: record.title,
        description: record.description,
        sourceUrl: record.sourceUrl,
        embedUrl: urls.embedUrl,
        platformLabel: platformLabels[record.platform],
        kindLabel: kindLabels[record.kind],
        publishedAt: record.publishedAt,
        publishedLabel: formatDate(record.publishedAt)
      };
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.id.localeCompare(right.id)));
  return cached;
}

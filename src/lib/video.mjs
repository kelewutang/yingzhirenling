const bilibiliBvidPattern = /^BV[1-9A-HJ-NP-Za-km-z]{10}$/;
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export const videoPlatforms = new Set(['bilibili', 'youtube']);

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidPlatformVideoId(platform, platformVideoId) {
  if (typeof platformVideoId !== 'string') return false;
  if (platform === 'bilibili') return bilibiliBvidPattern.test(platformVideoId);
  if (platform === 'youtube') return youtubeVideoIdPattern.test(platformVideoId);
  return false;
}

export function getVideoUrls(platform, platformVideoId) {
  if (!videoPlatforms.has(platform) || !isValidPlatformVideoId(platform, platformVideoId)) {
    throw new Error('Unsupported video platform or malformed platform video ID.');
  }

  if (platform === 'bilibili') {
    return {
      sourceUrl: `https://www.bilibili.com/video/${platformVideoId}/`,
      embedUrl: `https://player.bilibili.com/player.html?bvid=${platformVideoId}&page=1&high_quality=1&danmaku=0`
    };
  }

  return {
    sourceUrl: `https://www.youtube.com/watch?v=${platformVideoId}`,
    embedUrl: `https://www.youtube.com/embed/${platformVideoId}`
  };
}

export function isMatchingVideoSourceUrl(platform, platformVideoId, sourceUrl) {
  if (!isHttpsUrl(sourceUrl) || !isValidPlatformVideoId(platform, platformVideoId)) return false;
  return sourceUrl === getVideoUrls(platform, platformVideoId).sourceUrl;
}

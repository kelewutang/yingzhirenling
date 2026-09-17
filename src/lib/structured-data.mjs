const SITE_ORIGIN = 'https://www.yingzhirenling.cn';
const pageTypes = new Set(['WebPage', 'CollectionPage']);

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`Structured data ${label} must be a non-empty string`);
  return value;
}

function canonicalProductionUrl(value) {
  const url = new URL(requiredString(value, 'URL'));
  if (url.origin !== SITE_ORIGIN || url.search || url.hash || (url.pathname !== '/' && url.pathname.endsWith('/'))) {
    throw new TypeError(`Structured data URL must be a production canonical URL: ${value}`);
  }
  return url.href;
}

function assertSerializable(value) {
  if (value === null || value === undefined) throw new TypeError('Structured data must not contain null or undefined values');
  if (Array.isArray(value)) {
    for (const item of value) assertSerializable(item);
    return;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) assertSerializable(item);
  }
}

export function productionUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new TypeError(`Structured data route must be an absolute path: ${path}`);
  return canonicalProductionUrl(new URL(path, SITE_ORIGIN).href);
}

export function createPageIdentity({ type, name, description, url }) {
  if (!pageTypes.has(type)) throw new TypeError(`Unsupported page identity type: ${type}`);
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: requiredString(name, 'name'),
    description: requiredString(description, 'description'),
    url: canonicalProductionUrl(url)
  };
}

export function createBreadcrumbList(items) {
  if (!Array.isArray(items) || items.length < 2) throw new TypeError('BreadcrumbList requires at least two items');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, item }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: requiredString(name, 'breadcrumb name'),
      item: canonicalProductionUrl(item)
    }))
  };
}

export function serializeJsonLd(data) {
  assertSerializable(data);
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

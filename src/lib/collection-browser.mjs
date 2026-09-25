export const COLLECTION_BROWSER_ACTIVATION_THRESHOLD = 20;

export function normalizeCollectionSearchText(value) {
  const text = String(value ?? '');
  return (typeof text.normalize === 'function' ? text.normalize('NFKC') : text)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function safeBrowserItem(card) {
  if (card.concealed) return null;
  const displayName = String(card.displayName ?? '').trim();
  if (!displayName) throw new Error('Collection Browser card requires a safe displayName');
  const aliases = (Array.isArray(card.aliases) ? card.aliases : [])
    .map((alias) => String(alias).trim())
    .filter(Boolean);
  return {
    id: String(card.entity?.id ?? card.href),
    displayName,
    aliases,
    searchText: normalizeCollectionSearchText([displayName, ...aliases].join(' '))
  };
}

export function buildCollectionBrowserModel(cards, { threshold = COLLECTION_BROWSER_ACTIVATION_THRESHOLD } = {}) {
  if (!Number.isInteger(threshold) || threshold < 1) throw new Error('Collection Browser threshold must be a positive integer');
  const safeCards = cards.filter(({ card }) => !card.concealed);
  const items = safeCards.map(({ card }) => safeBrowserItem(card));
  return {
    active: safeCards.length >= threshold,
    compact: safeCards.length >= threshold,
    safeCount: safeCards.length,
    cards: safeCards,
    items
  };
}

export function findCollectionBrowserItems(items, query) {
  const normalizedQuery = normalizeCollectionSearchText(query);
  if (!normalizedQuery) return items;
  return items.filter((item) => item.searchText.includes(normalizedQuery));
}

export function collectionBrowserResult(items, query = '') {
  const matches = findCollectionBrowserItems(items, query);
  return {
    query: String(query),
    matchedIds: matches.map((item) => item.id),
    count: matches.length,
    empty: String(query).trim().length > 0 && matches.length === 0
  };
}

export function resetCollectionBrowserQuery() {
  return '';
}

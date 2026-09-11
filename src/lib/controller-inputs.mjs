const controlLabels = new Map([
  ['□', String.fromCodePoint(0x65b9, 0x5757, 0x952e)],
  ['△', String.fromCodePoint(0x4e09, 0x89d2, 0x952e)],
  ['○', String.fromCodePoint(0x5706, 0x5708, 0x952e)],
  ['L1', 'L1'],
  ['L2', 'L2']
]);
const controlMatcher = /L1|L2|□|△|○|\+/gu;
const controlTokenPattern = '(?:L1|L2|□|△|○)';
const controllerInputPattern = new RegExp(
  `^(?:${controlTokenPattern}(?:\\s+${controlTokenPattern})*|${controlTokenPattern}\\s*\\+\\s*${controlTokenPattern})$`,
  'u'
);
const inlineInputMatcher = /(?:L1|L2|□|△|○)(?:(?:\s*\+\s*|\s+)(?:L1|L2|□|△|○))*/gu;
const connectorLabel = String.fromCodePoint(0x52a0);

export function parseControllerInput(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new TypeError('Controller input must be a non-empty string');
  }

  const normalized = input.trim();
  if (!controllerInputPattern.test(normalized)) {
    throw new Error(`Unsupported controller input: ${input}`);
  }
  const values = [...normalized.matchAll(controlMatcher)].map((match) => match[0]);
  if (values.length === 0) {
    throw new Error(`Unsupported controller input: ${input}`);
  }

  const tokens = values.map((value) => value === '+'
    ? { kind: 'connector', value, label: connectorLabel }
    : { kind: 'control', value, label: controlLabels.get(value) }
  );

  return {
    input: normalized,
    tokens,
    accessibleText: tokens.map((token) => token.label).join(' ')
  };
}

export function parseInlineControllerText(text) {
  if (typeof text !== 'string') throw new TypeError('Controller description must be a string');

  const segments = [];
  let cursor = 0;
  for (const match of text.matchAll(inlineInputMatcher)) {
    const [input] = match;
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'text', value: text.slice(cursor, index) });
    segments.push({ kind: 'input', value: input, parsed: parseControllerInput(input) });
    cursor = index + input.length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) });
  return segments;
}

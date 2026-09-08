import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const textExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.mjs']);
// Fixtures used by production validation currently use ASCII-only titles, which
// are included below as the mandatory ASCII range.
const sourceInputs = ['data', 'src'];
const legacyInputs = ['404.html', 'pages'];
const requiredPunctuation = '，。！？、；：‘’“”「」《》〈〉（）【】［］〔〕——…·';
const excludedSourceFiles = new Set([resolve(root, 'src/components/SiteHeader.astro')]);
const requiredStaticDisplayText = '影之刃零攻略站';

function extension(path) {
  return path.slice(path.lastIndexOf('.'));
}

async function collectFiles(path, files) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
    } else if (entry.isFile() && textExtensions.has(extension(entry.name))) {
      files.push(entryPath);
    }
  }
}

export async function collectDisplayCorpus() {
  const files = [];
  for (const input of sourceInputs) {
    const inputPath = resolve(root, input);
    const inputStats = await stat(inputPath).catch(() => undefined);
    if (!inputStats) throw new Error(`PBZ Serif corpus input is missing: ${input}`);
    if (inputStats.isDirectory()) await collectFiles(inputPath, files);
    else files.push(inputPath);
  }

  const characters = new Set([
    ...Array.from({ length: 0x7f - 0x20 }, (_, index) => String.fromCodePoint(index + 0x20)),
    ...requiredPunctuation,
    ...requiredStaticDisplayText
  ]);
  const legacyFiles = [];
  for (const input of legacyInputs) {
    const inputPath = resolve(root, input);
    const inputStats = await stat(inputPath).catch(() => undefined);
    if (!inputStats) throw new Error(`PBZ Serif legacy corpus input is missing: ${input}`);
    if (inputStats.isDirectory()) await collectFiles(inputPath, legacyFiles);
    else legacyFiles.push(inputPath);
  }
  for (const file of files.filter((file) => !excludedSourceFiles.has(file)).sort((left, right) => left.localeCompare(right, 'en'))) {
    addCharacters(characters, await readFile(file, 'utf8'));
  }
  for (const file of legacyFiles.sort((left, right) => left.localeCompare(right, 'en'))) {
    addCharacters(characters, extractLegacyDisplayText(await readFile(file, 'utf8')));
  }

  const codePoints = [...characters].map((character) => character.codePointAt(0)).sort((left, right) => left - right);
  return {
    codePoints,
    files: [...files.filter((file) => !excludedSourceFiles.has(file)), ...legacyFiles].map((file) => relative(root, file).replaceAll('\\', '/')).sort((left, right) => left.localeCompare(right, 'en')),
    text: String.fromCodePoint(...codePoints)
  };
}

function addCharacters(characters, text) {
  for (const character of text.normalize('NFC')) {
    const codePoint = character.codePointAt(0);
    if (codePoint >= 0x20 && codePoint !== 0x7f && !isVariationSelector(codePoint)) characters.add(character);
  }
}

function extractLegacyDisplayText(html) {
  const selected = [];
  for (const match of html.matchAll(/<(h1|h2|h3|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const [, tag, attributes, contents] = match;
    if (tag.toLowerCase().startsWith('h') || /class=["'][^"']*\b(?:nav-logo|footer-logo)\b[^"']*["']/i.test(attributes)) {
      selected.push(contents.replace(/<[^>]*>/g, ' '));
    }
  }
  return selected.join(' ');
}

export async function writeDisplayCorpus(outputPath) {
  const corpus = await collectDisplayCorpus();
  await writeFile(outputPath, corpus.text, 'utf8');
  return corpus;
}

export function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function isVariationSelector(codePoint) {
  return (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
}

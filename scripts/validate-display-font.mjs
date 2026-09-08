import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectDisplayCorpus, formatCodePoint } from './fonts/pbz-serif-corpus.mjs';
import { getWoff2CmapCoverage, getWoff2WeightRange } from './fonts/woff2-cmap.mjs';

const root = resolve(import.meta.dirname, '..');
const fontDirectory = resolve(root, 'public/fonts/pbz-serif');
const distFontDirectory = resolve(root, 'dist/fonts/pbz-serif');
const licensePath = resolve(fontDirectory, 'OFL.txt');
const provenancePath = resolve(fontDirectory, 'README.md');
const cssPath = resolve(root, 'css/style.css');
const maxPayload = 3 * 1024 * 1024;
const preferredPayload = 1.5 * 1024 * 1024;
const acceptablePayload = 2.5 * 1024 * 1024;
const requireDist = process.argv.includes('--require-dist');

const fontFiles = (await readdir(fontDirectory)).filter((file) => file.endsWith('.woff2')).sort();
assert.deepEqual(fontFiles, ['PBZSerif-Display-Subset.woff2'], 'PBZ Serif must ship exactly one project-generated subset WOFF2');
const fontFile = fontFiles[0];
const fontPath = resolve(fontDirectory, fontFile);
const [font, license, provenance, css, corpus] = await Promise.all([
  readFile(fontPath),
  readFile(licensePath, 'utf8'),
  readFile(provenancePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  collectDisplayCorpus()
]);

assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2', 'PBZ Serif must be a WOFF2 asset');
assert.ok(font.byteLength <= maxPayload, `PBZ Serif payload exceeds the 3 MiB gate: ${font.byteLength} bytes`);
assert.match(license, /Copyright 2017-2022 Adobe/);
assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
assert.match(provenance, /project-generated subset/i);
assert.match(provenance, /SourceHanSerifCN-VF\.otf\.woff2/);
assert.match(provenance, /validation must fail/i);
assert.match(css, /@font-face\s*\{\s*font-family: "PBZ Serif";\s*src: url\("\/fonts\/pbz-serif\/PBZSerif-Display-Subset\.woff2"\) format\("woff2"\);\s*font-style: normal;\s*font-weight: 400 700;\s*font-display: swap;\s*\}/);
assert.match(css, /--font-display: "PBZ Serif", "Songti SC", "STSong", "SimSun", serif;/);
assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com|@import[^;]*(font|Font)/);

const weightRange = getWoff2WeightRange(font);
assert.deepEqual(weightRange, { min: 400, max: 700 }, 'PBZ Serif CSS must match the shipped variable wght range');
const coverage = getWoff2CmapCoverage(font);
const missing = corpus.codePoints.filter((codePoint) => !coverage.has(codePoint));
assert.equal(
  missing.length,
  0,
  `PBZ Serif missing required glyphs: ${missing.map((codePoint) => `${String.fromCodePoint(codePoint)} ${formatCodePoint(codePoint)}`).join(', ')}`
);

if (requireDist) {
  assert.ok(await exists(distFontDirectory), 'Built PBZ Serif font directory is missing');
  const builtFontPath = resolve(distFontDirectory, fontFile);
  const [builtFont, builtLicense] = await Promise.all([
    readFile(builtFontPath),
    readFile(resolve(distFontDirectory, 'OFL.txt'))
  ]);
  assert.deepEqual(builtFont, font, 'Built PBZ Serif font must match the checked-in source asset');
  assert.deepEqual(builtLicense, await readFile(licensePath), 'Built PBZ Serif license must match the checked-in notice');
}

console.log(`PBZ Serif payload: ${font.byteLength} bytes (${(font.byteLength / 1024 / 1024).toFixed(2)} MiB); required corpus: ${corpus.codePoints.length} code points across ${corpus.files.length} files.`);
if (font.byteLength > acceptablePayload) console.warn('PBZ Serif payload warning: above the 2.5 MiB acceptable target.');
else if (font.byteLength > preferredPayload) console.warn('PBZ Serif payload note: above the 1.5 MiB preferred target.');
console.log('Display font contract and glyph coverage validation passed.');

async function exists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

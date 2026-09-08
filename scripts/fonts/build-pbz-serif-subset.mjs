import { access, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { writeDisplayCorpus } from './pbz-serif-corpus.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const source = valueFor('--source');
const output = valueFor('--output') || resolve(root, 'public/fonts/pbz-serif/PBZSerif-Display-Subset.woff2');

if (!source) {
  throw new Error('Usage: PBZ_FONTTOOLS_PYTHON=python3 node scripts/fonts/build-pbz-serif-subset.mjs --source /path/to/SourceHanSerifCN-VF.otf.woff2 [--output /path/to/PBZSerif-Display-Subset.woff2]');
}

await access(source);
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pbz-serif-corpus-'));
try {
  const corpusPath = join(temporaryDirectory, 'display-corpus.txt');
  const corpus = await writeDisplayCorpus(corpusPath);
  const python = process.env.PBZ_FONTTOOLS_PYTHON || 'python3';
  const result = spawnSync(python, [
    resolve(import.meta.dirname, 'subset-pbz-serif.py'),
    '--source', source,
    '--corpus', corpusPath,
    '--output', output
  ], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `PBZ Serif subset generation failed with exit code ${result.status}`);
  process.stdout.write(`PBZ Serif subset generated from ${corpus.codePoints.length} required code points.\n${result.stdout}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function valueFor(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

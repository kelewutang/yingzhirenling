import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const pocRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(pocRoot, '../..');
const result = spawnSync(process.execPath, ['scripts/validate-data.mjs'], {
  cwd: repositoryRoot,
  stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const directories = ['weapons', 'characters', 'bosses', 'locations'];
const entities = (await Promise.all(directories.map(async (directory) => Promise.all((await readdir(resolve(root, 'data', directory))).filter((file) => file.endsWith('.json')).map(async (file) => JSON.parse(await readFile(resolve(root, 'data', directory, file), 'utf8'))))))).flat();
for (const entity of entities.filter((entity) => entity.recordState === 'published')) assert.equal(entity.spoilerLevel, 'none', `${entity.id}: published Entity must explicitly classify spoilerLevel`);
const search = JSON.parse(await readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'));
for (const document of search) assert.notEqual(document.spoilerLevel, 'major', 'production Search must not contain a major spoiler document');
console.log('Spoiler delivery check passed: published Entity classifications and production Search projection are safe.');

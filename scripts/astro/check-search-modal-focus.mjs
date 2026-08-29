import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = await readFile(resolve(import.meta.dirname, '../../js/main.js'), 'utf8');
const openSearch = source.slice(source.indexOf('function openSearch()'), source.indexOf('function closeSearch()'));
const focusTrap = source.slice(source.indexOf('function containSearchFocus(e)'), source.indexOf('function doSearch()'));

assert.match(openSearch, /role="dialog"/);
assert.match(openSearch, /aria-modal="true"/);
assert.ok(
  openSearch.indexOf("searchOverlay.classList.add('active')") < openSearch.indexOf('input.focus()'),
  'Search overlay must be visible before its input receives focus'
);
assert.doesNotMatch(openSearch, /setTimeout[\s\S]*classList\.add\('active'\)/);
assert.match(focusTrap, /e\.key !== 'Tab'/);
assert.match(focusTrap, /e\.shiftKey[\s\S]*last\.focus\(\)/);
assert.match(focusTrap, /!e\.shiftKey[\s\S]*first\.focus\(\)/);
assert.match(source, /document\.addEventListener\('keydown',[\s\S]*containSearchFocus\(e\)/);

console.log('Search modal focus regression check passed.');

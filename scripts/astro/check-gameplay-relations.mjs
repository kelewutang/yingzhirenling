import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKnowledge } from '../../src/lib/knowledge.mjs';
import { projectGameplayRelations } from '../../src/lib/gameplay-relations.mjs';

const k = await loadKnowledge(), directories = { boss: 'bosses', weapon: 'weapons', location: 'world', character: 'characters' };
let pages = 0, entries = 0;
for (const entity of k.entityById.values()) {
  if (entity.recordState !== 'published' || !directories[entity.entityType]) continue;
  const html = await readFile(resolve('dist', directories[entity.entityType], entity.slug + '.html'), 'utf8');
  const groups = projectGameplayRelations(entity, k);
  for (const marker of ['class="source-panel"', 'class="info-status"', 'quick-fact__status', 'detail-fact__provenance', 'info-provenance__meta', 'entity-hero__updated', '第三方信息', '资料阶段', '关联核验']) {
    assert(!html.includes(marker), `${entity.id}: removed provenance UI reappeared: ${marker}`);
  }
  assert.equal((html.match(/data-gameplay-relations=/g) || []).length, groups.length, entity.id);
  const expected = groups.flatMap((g) => g.entries).flatMap((e) => [e, ...e.children]);
  assert.equal((html.match(/data-gameplay-relation-id=/g) || []).length, expected.length, entity.id);
  for (const entry of expected) {
    assert(html.includes(`data-gameplay-relation-id="${entry.relation.id}"`), entry.relation.id);
    assert(html.includes(`href="${entry.href}"`), `${entity.id}: missing public target`);
    assert(k.versionById.has(entry.relation.gameVersionId), `${entity.id}: missing evidence version`);
    assert(entry.relation.sourceIds.every((id) => k.sourceById.has(id)), `${entity.id}: missing evidence source`);
  }
  // Verify concealment from actual static markup, including all nested links.
  const stack = [];
  const concealedIds = new Set();
  for (const group of groups) for (const entry of group.entries) if (entry.concealed) {
    for (const e of [entry, ...entry.children]) concealedIds.add(e.relation.id);
  }
  for (const tag of html.matchAll(/<\/?(?:details|article)\b[^>]*>/g)) {
    if (tag[0].startsWith('<details')) {
      if (tag[0].includes('data-spoiler-level="major"')) assert(!/\bopen(?:\s|=|>)/.test(tag[0]), 'Major relation starts open');
      stack.push(tag[0].includes('data-spoiler-level="major"'));
    } else if (tag[0].startsWith('</details')) stack.pop();
    else if (tag[0].startsWith('<article')) {
      const id = tag[0].match(/data-gameplay-relation-id="([^"]+)"/)?.[1];
      if (concealedIds.has(id)) assert(stack.includes(true), `${id}: relation leaks outside disclosure`);
    }
  }
  if (groups.length) pages++;
  entries += expected.length;
}
console.log(`Gameplay relation static verification passed: ${pages} pages, ${entries} directed/nested entries; public links and spoiler disclosures intact.`);

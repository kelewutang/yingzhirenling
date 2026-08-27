import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchDocuments } from './build-search-index.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const FIXTURE_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'search-index-cases.json');

function fixtureRecords(testCase) {
  return testCase.weapons.map((weapon, index) => ({
    file: `fixture:${testCase.name}[${index}]`,
    weapon
  }));
}

function verifyDocuments(testCase, documents) {
  const expected = testCase.expected;
  assert.deepEqual(
    documents.map((document) => document.id),
    expected.documentIds,
    `${testCase.name}: documentIds 不符合预期`
  );

  const byId = new Map(documents.map((document) => [document.id, document]));
  for (const [id, fields] of Object.entries(expected.documents ?? {})) {
    const document = byId.get(id);
    assert.ok(document, `${testCase.name}: 缺少 ${id}`);
    for (const [field, value] of Object.entries(fields)) {
      assert.deepEqual(document[field], value, `${testCase.name}: ${id}.${field} 不符合预期`);
    }
  }

  if (expected.sharedRoute) {
    assert.ok(documents.length > 1, `${testCase.name}: shared route 至少需要两个 document`);
    assert.ok(
      documents.every((document) => document.route === expected.sharedRoute),
      `${testCase.name}: route 未正确共享`
    );
  }

  const serialized = JSON.stringify(documents);
  for (const forbidden of expected.forbiddenText ?? []) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `${testCase.name}: Search Document 泄漏禁止文本：${forbidden}`
    );
  }
}

async function main() {
  const fixture = JSON.parse(await fs.readFile(FIXTURE_FILE, 'utf8'));
  assert.equal(fixture.fixtureOnly, true, 'fixture 必须明确标记 fixtureOnly=true');

  let passed = 0;
  for (const testCase of fixture.cases) {
    const records = fixtureRecords(testCase);
    try {
      const first = buildSearchDocuments(records, testCase.mode);
      const second = buildSearchDocuments(records, testCase.mode);
      assert.deepEqual(second, first, `${testCase.name}: 相同输入未产生确定性结果`);

      if (testCase.expected.errorIncludes) {
        throw new Error(`${testCase.name}: 预期失败但实际通过`);
      }
      verifyDocuments(testCase, first.documents);
      console.log(`PASS ${testCase.name}`);
      passed += 1;
    } catch (cause) {
      if (!testCase.expected.errorIncludes) throw cause;
      assert.ok(
        cause.message.includes(testCase.expected.errorIncludes),
        `${testCase.name}: 错误不符合预期：${cause.message}`
      );
      console.log(`PASS ${testCase.name}: expected failure`);
      passed += 1;
    }
  }

  console.log(`Search index fixture cases: ${passed}`);
}

main().catch((cause) => {
  console.error(`Search index fixture validation failed: ${cause.message}`);
  process.exitCode = 1;
});

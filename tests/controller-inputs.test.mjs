import assert from 'node:assert/strict';
import { parseControllerInput, parseInlineControllerText } from '../src/lib/controller-inputs.mjs';

const labels = { '□': '方块键', '△': '三角键', '○': '圆圈键', L1: 'L1', L2: 'L2' };

for (const [input, values] of [
  ['□', ['□']],
  ['△', ['△']],
  ['○', ['○']],
  ['L1', ['L1']],
  ['L2', ['L2']],
  ['L1 + △', ['L1', '+', '△']],
  ['□ □ □ □ □', ['□', '□', '□', '□', '□']]
]) {
  const parsed = parseControllerInput(input);
  assert.deepEqual(parsed.tokens.map((token) => token.value), values, `Tokens must remain ordered: ${input}`);
  for (const token of parsed.tokens.filter((token) => token.kind === 'control')) {
    assert.equal(token.label, labels[token.value], `Accessible label missing: ${token.value}`);
  }
}

assert.deepEqual(
  parseInlineControllerText('再次按下 L1 + △ 可回收。').map((segment) => segment.kind),
  ['text', 'input', 'text'],
  'Inline controller combinations must remain structured keycaps'
);
assert.throws(() => parseControllerInput('R1'), /Unsupported controller input/, 'Unsupported platform controls must not silently render as keycaps');
for (const input of [
  '+ △',
  'L1 +',
  'L1 ++ △',
  'L1 + + △',
  '+',
  'L1 + △ + ○',
  'L1 + △ □',
  'L1 + / △'
]) {
  assert.throws(() => parseControllerInput(input), /Unsupported controller input/, `Malformed separator syntax must reject: ${input}`);
}

console.log('Controller input parsing verification passed.');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChoiceOptions, hasValidChoiceLabels } from './multiple-choice-options.ts';

test('four-choice questions remain four choices when opened for review', () => {
  const options=['A','B','C','D'].map(label=>({label,option_text:label,is_correct:label==='D'}));
  assert.deepEqual(normalizeChoiceOptions(options),options);
  assert.equal(hasValidChoiceLabels(options),true);
});
test('five-choice defaults and existing E answers are preserved', () => {
  assert.equal(normalizeChoiceOptions().length,5);
  const options=normalizeChoiceOptions().map(o=>({...o,is_correct:o.label==='E'}));
  assert.deepEqual(normalizeChoiceOptions(options),options);
});
test('removing a correct E requires choosing a new correct answer', () => {
  const options=normalizeChoiceOptions().map(o=>({...o,is_correct:o.label==='E'}));
  assert.equal(normalizeChoiceOptions(options,4).some(o=>o.is_correct),false);
});
test('invalid labels and unsupported counts fail validation', () => {
  for (const labels of [['A','B','C'],['A','B','C','C'],['B','A','C','D'],['A','B','C','D','E','F']]) assert.equal(hasValidChoiceLabels(labels.map(label=>({label}))),false);
});

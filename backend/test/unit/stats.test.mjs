/** D3 unit — rank statistics (src/lib/stats.js). Pure, deterministic. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranks, spearman } from '../../src/lib/stats.js';

test('ranks: strictly increasing series is 1..n in place', () => {
  assert.deepEqual(ranks([10, 20, 30]), [1, 2, 3]);
});

test('ranks: order is by value, not position', () => {
  // values 30,10,20 → ranks 3,1,2
  assert.deepEqual(ranks([30, 10, 20]), [3, 1, 2]);
});

test('ranks: ties get the averaged rank of the tie run', () => {
  // two values tied for ranks 1 and 2 → both 1.5; the larger is rank 3
  assert.deepEqual(ranks([5, 5, 9]), [1.5, 1.5, 3]);
  // a three-way tie spanning ranks 1,2,3 → all 2
  assert.deepEqual(ranks([7, 7, 7]), [2, 2, 2]);
});

test('ranks: empty input yields empty output', () => {
  assert.deepEqual(ranks([]), []);
});

test('spearman: returns null on length mismatch', () => {
  assert.equal(spearman([1, 2, 3], [1, 2]), null);
});

test('spearman: returns null when n < 2', () => {
  assert.equal(spearman([1], [1]), null);
  assert.equal(spearman([], []), null);
});

test('spearman: returns null for a constant series (no ordering to correlate)', () => {
  assert.equal(spearman([5, 5, 5], [1, 2, 3]), null); // dx === 0
  assert.equal(spearman([1, 2, 3], [9, 9, 9]), null); // dy === 0
});

test('spearman: perfectly monotone increasing → +1', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
});

test('spearman: perfectly monotone decreasing → -1', () => {
  assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
});

test('spearman: monotone but non-linear is still +1 (rank-based)', () => {
  assert.equal(spearman([1, 2, 3, 4], [1, 4, 9, 1000]), 1);
});

test('spearman: a clear negative association lands in (-1, 0)', () => {
  const rho = spearman([1, 2, 3, 4], [4, 3, 1, 2]);
  assert.ok(rho < 0 && rho > -1, `expected negative <1 in magnitude, got ${rho}`);
});

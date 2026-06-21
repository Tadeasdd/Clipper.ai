/** D3 unit — the dependency-free request validator (src/lib/validate.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBody, validate, paginate } from '../../src/lib/validate.js';

test('checkBody: a valid body produces no errors', () => {
  const schema = { name: { type: 'string', required: true } };
  assert.deepEqual(checkBody({ name: 'Ada' }, schema), []);
});

test('checkBody: missing required field is reported; optional absent is fine', () => {
  const schema = { name: { type: 'string', required: true }, note: { type: 'string' } };
  assert.deepEqual(checkBody({}, schema), ['name is required']);
  assert.deepEqual(checkBody({ name: 'x' }, schema), []);
});

test('checkBody: blank/whitespace string counts as absent', () => {
  const schema = { name: { type: 'string', required: true } };
  assert.deepEqual(checkBody({ name: '   ' }, schema), ['name is required']);
});

test('checkBody: a non-object body is treated as empty', () => {
  const schema = { name: { type: 'string', required: true } };
  assert.deepEqual(checkBody(null, schema), ['name is required']);
  assert.deepEqual(checkBody('nope', schema), ['name is required']);
});

test('checkBody: type mismatches for each supported type', () => {
  assert.deepEqual(checkBody({ a: 'x' }, { a: { type: 'number' } }), ['a must be a number']);
  assert.deepEqual(checkBody({ a: 1 }, { a: { type: 'array' } }), ['a must be a array']);
  assert.deepEqual(checkBody({ a: [] }, { a: { type: 'object' } }), ['a must be a object']);
  assert.deepEqual(checkBody({ a: 'x' }, { a: { type: 'boolean' } }), ['a must be a boolean']);
  // correct types pass
  assert.deepEqual(checkBody({ a: [1] }, { a: { type: 'array' } }), []);
  assert.deepEqual(checkBody({ a: { k: 1 } }, { a: { type: 'object' } }), []);
});

test('checkBody: enum, maxLength, and numeric min/max', () => {
  assert.deepEqual(checkBody({ p: 'huge' }, { p: { enum: ['small', 'big'] } }), [
    'p must be one of: small, big',
  ]);
  assert.deepEqual(checkBody({ s: 'abcd' }, { s: { type: 'string', maxLength: 3 } }), [
    's is too long (max 3)',
  ]);
  assert.deepEqual(checkBody({ n: 0 }, { n: { type: 'number', min: 1 } }), ['n must be ≥ 1']);
  assert.deepEqual(checkBody({ n: 9 }, { n: { type: 'number', max: 5 } }), ['n must be ≤ 5']);
  assert.deepEqual(checkBody({ n: 3 }, { n: { type: 'number', min: 1, max: 5 } }), []);
});

test('checkBody: custom test with and without a message', () => {
  const even = { test: (v) => v % 2 === 0, message: 'must be even' };
  assert.deepEqual(checkBody({ n: 3 }, { n: even }), ['must be even']);
  assert.deepEqual(checkBody({ n: 4 }, { n: even }), []);
  // falls back to a generic message when none provided
  assert.deepEqual(checkBody({ n: 3 }, { n: { test: (v) => v > 100 } }), ['n is invalid']);
});

test('checkBody: strict mode rejects unexpected top-level fields', () => {
  const schema = { a: { type: 'string' } };
  assert.deepEqual(checkBody({ a: 'x', extra: 1 }, schema, { strict: true }), [
    'unexpected field: extra',
  ]);
  // non-strict (default) allows extras
  assert.deepEqual(checkBody({ a: 'x', extra: 1 }, schema), []);
});

test('validate: middleware 400s on a bad body with first error + full list', () => {
  const mw = validate({ name: { type: 'string', required: true } });
  let status, payload;
  const res = {
    status(c) {
      status = c;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
  };
  let nexted = false;
  mw({ body: {} }, res, () => {
    nexted = true;
  });
  assert.equal(status, 400);
  assert.equal(payload.error, 'name is required');
  assert.deepEqual(payload.errors, ['name is required']);
  assert.equal(nexted, false);
});

test('validate: middleware calls next() on a good body', () => {
  const mw = validate({ name: { type: 'string', required: true } });
  let nexted = false;
  mw({ body: { name: 'ok' } }, {}, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});

test('validate: strict can be disabled to allow free-form extras', () => {
  const mw = validate({ a: { type: 'string' } }, { strict: false });
  let nexted = false;
  mw({ body: { a: 'x', meta: { any: 1 } } }, {}, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});

test('paginate: defaults apply when query is absent', () => {
  assert.deepEqual(paginate({}), { limit: 50, offset: 0 });
  assert.deepEqual(paginate({ query: {} }, { def: 25 }), { limit: 25, offset: 0 });
});

test('paginate: clamps to the hard max and floor of 1, and floors offset', () => {
  assert.deepEqual(paginate({ query: { limit: '9999', offset: '10' } }, { max: 200 }), {
    limit: 200,
    offset: 10,
  });
  assert.deepEqual(paginate({ query: { limit: '0' } }), { limit: 1, offset: 0 });
  assert.deepEqual(paginate({ query: { offset: '-5' } }), { limit: 50, offset: 0 });
  // non-finite falls back to defaults
  assert.deepEqual(paginate({ query: { limit: 'abc', offset: 'xyz' } }), { limit: 50, offset: 0 });
  // fractional values floor
  assert.deepEqual(paginate({ query: { limit: '10.9', offset: '3.9' } }), { limit: 10, offset: 3 });
});

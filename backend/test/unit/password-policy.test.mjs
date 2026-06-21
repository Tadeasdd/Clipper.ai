/** D3 unit — password policy (src/lib/password-policy.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordError, isPasswordAcceptable, PW_MIN } from '../../src/lib/password-policy.js';

test('PW_MIN defaults to 8', () => {
  assert.equal(PW_MIN, 8);
});

test('rejects passwords shorter than the minimum', () => {
  assert.equal(passwordError('short1'), 'password must be ≥ 8 characters');
  assert.equal(passwordError(''), 'password must be ≥ 8 characters');
});

test('rejects common passwords case-insensitively', () => {
  assert.equal(
    passwordError('password'),
    'password is too common — choose something less guessable',
  );
  assert.equal(
    passwordError('PASSWORD'),
    'password is too common — choose something less guessable',
  );
  assert.equal(
    passwordError('ChangeMe'),
    'password is too common — choose something less guessable',
  );
});

test('rejects a single repeated character', () => {
  assert.equal(passwordError('aaaaaaaa'), 'password cannot be a single repeated character');
  assert.equal(passwordError('99999999'), 'password cannot be a single repeated character');
});

test('accepts a reasonable password (returns null)', () => {
  assert.equal(passwordError('correct-horse-battery'), null);
});

test('treats null/undefined as an empty string (too short)', () => {
  assert.equal(passwordError(undefined), 'password must be ≥ 8 characters');
  assert.equal(passwordError(null), 'password must be ≥ 8 characters');
});

test('isPasswordAcceptable mirrors passwordError', () => {
  assert.equal(isPasswordAcceptable('correct-horse-battery'), true);
  assert.equal(isPasswordAcceptable('password'), false);
  assert.equal(isPasswordAcceptable('short'), false);
});

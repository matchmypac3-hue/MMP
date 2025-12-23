import { isValidUsername, normalizeUsername } from '../utils/username';

describe('utils/username', () => {
  test('normalizeUsername trims + lowercases', () => {
    expect(normalizeUsername('  AbC_12  ')).toBe('abc_12');
  });

  test('normalizeUsername returns empty string for non-string', () => {
    expect(normalizeUsername(undefined)).toBe('');
    expect(normalizeUsername(null)).toBe('');
    expect(normalizeUsername(123)).toBe('');
  });

  test('isValidUsername enforces length and charset', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a'.repeat(20))).toBe(true);
    expect(isValidUsername('a'.repeat(21))).toBe(false);

    expect(isValidUsername('user_name')).toBe(true);
    expect(isValidUsername('User_Name')).toBe(true); // normalized
    expect(isValidUsername('bad-name')).toBe(false);
    expect(isValidUsername('has space')).toBe(false);
  });
});

export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: unknown): boolean {
  const username = normalizeUsername(raw);
  if (username.length < 3 || username.length > 20) return false;
  return /^[a-z0-9_]+$/.test(username);
}

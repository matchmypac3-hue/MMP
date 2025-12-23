// Prefer Expo public env var for dev/staging overrides.
// Example: EXPO_PUBLIC_API_URL=http://localhost:5001
// Example: EXPO_PUBLIC_API_URL=http://localhost:5001/api

const normalizeApiUrl = (value: string): string => {
	const trimmed = value.trim().replace(/\/+$/, '');
	// If the caller already provided an /api segment (ex: /api or /api/v2), keep it.
	if (/(\/api)(\/|$)/.test(trimmed)) return trimmed;
	return `${trimmed}/api`;
};

const RAW_API_URL =
	process.env.EXPO_PUBLIC_API_URL || 'https://server-ls5m.onrender.com/api';

export const API_URL = normalizeApiUrl(RAW_API_URL);

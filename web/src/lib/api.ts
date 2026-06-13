const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ks_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  getMe: () => request('/auth/me'),
  generateAds: () =>
    request('/ads/generate', { method: 'POST' }),
  checkValidation: (code: string) =>
    request('/validation/check', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  getValidationStatus: () => request('/validation/status'),
  validateWithApiKey: (apiKey: string, code: string) =>
    request('/validation/api-key', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: JSON.stringify({ code }),
    }),
};

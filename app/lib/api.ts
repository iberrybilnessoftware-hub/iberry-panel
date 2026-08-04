'use client';

/**
 * Panelin merkez API'ye tek çıkış noktası.
 *
 * Her şey `/api/proxy/...` üzerinden gidiyor (bkz. route.ts) — tarayıcı
 * merkez API'nin adresini hiç bilmiyor, dolayısıyla CORS da yok.
 */

const JETON = 'iberry_dev_token';

export function jetonAl(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JETON);
}

export function jetonYaz(t: string) { localStorage.setItem(JETON, t); }
export function jetonSil() { localStorage.removeItem(JETON); }

export class ApiHatasi extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(yol: string, opts: RequestInit = {}): Promise<T> {
  const jeton = jetonAl();
  const res = await fetch(`/api/proxy/${yol}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      ...opts.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let mesaj = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      mesaj = b?.error?.message ?? b?.message ?? mesaj;
    } catch { /* gövde JSON değilse durum kodu yeter */ }
    throw new ApiHatasi(res.status, Array.isArray(mesaj) ? mesaj.join(', ') : String(mesaj));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function girisYap(email: string, password: string) {
  const r = await api<{ accessToken: string; user: { fullName: string; permissions: string[] } }>(
    'auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  jetonYaz(r.accessToken);
  return r.user;
}

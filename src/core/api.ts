/** Backend client. Never throws, never logs: every failure resolves to null. */

const BACKEND_ON = import.meta.env.VITE_BACKEND === '1';

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!BACKEND_ON) return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal, headers: { 'content-type': 'application/json' } });
    const body = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) return (body as any)?.error ? body : null;
    return body;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface Wish { id: string; name: string; wish: string; sticker: string; createdAt: number }

export const api = {
  enabled: BACKEND_ON,
  getCounter: () => call<{ dreams: number }>('/api/counter'),
  hitCounter: () => call<{ dreams: number }>('/api/counter', { method: 'POST' }),
  getWishes: (cursor = 0) => call<{ items: Wish[]; next: number | null }>(`/api/guestbook?cursor=${cursor}`),
  postWish: (w: { name: string; wish: string; sticker: string; hp: string }) =>
    call<{ item?: Wish; error?: string }>('/api/guestbook', { method: 'POST', body: JSON.stringify(w) }),
};

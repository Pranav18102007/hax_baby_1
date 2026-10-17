import { Ratelimit } from '@upstash/ratelimit';
import { redis, json, ipOf } from './_shared';

/** The dream guestbook. Stored as plain text; the frontend renders with textContent only. */
const LIST = 'pip:wishes';
const STICKERS = new Set(['ghost', 'duck', 'star', 'moon', 'kitten', 'unicorn']);
const perMinute = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '60 s'), prefix: 'pip:rl:wish' });

// Kept short on purpose: catches the common stuff; normalised before matching.
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'slut', 'whore', 'nigg', 'fag', 'rape', 'porn',
  'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'bhosdi', 'gaand', 'randi', 'lavda', 'lauda', 'kutta', 'harami'];

function normalise(s: string): string {
  return s.toLowerCase()
    .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

const hasLink = (s: string) => /(https?:|www\.|\.(com|net|org|in|io|xyz|ru|ly)\b)/i.test(s);

export async function GET(req: Request): Promise<Response> {
  try {
    const cursor = Math.max(0, Number(new URL(req.url).searchParams.get('cursor')) || 0);
    const raw = await redis.lrange<string | object>(LIST, cursor, cursor + 19);
    const items = raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
    const total = await redis.llen(LIST);
    return json({ items, next: cursor + 20 < total ? cursor + 20 : null });
  } catch {
    return json({ error: 'asleep' }, 503);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: { name?: unknown; wish?: unknown; sticker?: unknown; hp?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const name = String(body.name ?? '').trim().slice(0, 40);
  const wish = String(body.wish ?? '').trim();
  const sticker = String(body.sticker ?? '');
  if (String(body.hp ?? '')) return json({ item: null }, 201); // honeypot: pretend it worked
  if (!name || name.length > 24 || !wish || wish.length > 140) return json({ error: 'too_long' }, 400);
  if (!STICKERS.has(sticker)) return json({ error: 'bad_sticker' }, 400);
  const flat = normalise(`${name} ${wish}`);
  if (hasLink(`${name} ${wish}`) || BLOCK.some((w) => flat.includes(w))) return json({ error: 'blocked' }, 400);

  try {
    const { success } = await perMinute.limit(ipOf(req));
    if (!success) return json({ error: 'slow_down' }, 429);
    const item = { id: crypto.randomUUID().slice(0, 8), name, wish, sticker, createdAt: Date.now() };
    await redis.lpush(LIST, JSON.stringify(item));
    await redis.ltrim(LIST, 0, 499);
    return json({ item }, 201);
  } catch {
    return json({ error: 'asleep' }, 503);
  }
}

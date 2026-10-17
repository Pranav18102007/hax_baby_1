import { Ratelimit } from '@upstash/ratelimit';
import { redis, json, ipOf } from './_shared.js';

/** GET: read the dream counter. POST: count one visit (max once per IP per day). */
const KEY = 'pip:dreams';
const SEED = 1204;
const daily = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(1, '1 d'), prefix: 'pip:rl:hit' });

export async function GET(req: Request): Promise<Response> {
  try {
    const n = (await redis.get<number>(KEY)) ?? 0;
    return json({ dreams: SEED + n });
  } catch (e) {
    console.error('counter GET', e);
    const why = String((e as Error)?.message ?? e).slice(0, 160);
    return json({ error: 'asleep', why }, new URL(req.url).searchParams.has('debug') ? 200 : 503);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { success } = await daily.limit(ipOf(req));
    const n = success ? await redis.incr(KEY) : (await redis.get<number>(KEY)) ?? 0;
    return json({ dreams: SEED + n });
  } catch (e) {
    console.error('counter POST', e);
    return json({ error: 'asleep' }, 503);
  }
}

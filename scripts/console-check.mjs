// Opens the built site at 3 sizes, clicks through the main controls, screenshots each scene,
// and exits non-zero if anything is written to the console or a request fails.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/console-check.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.argv[2] || 'test-results';
fs.mkdirSync(OUT, { recursive: true });

const sizes = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900 },
];

const problems = [];
const exe = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, isMobile: !!s.isMobile, hasTouch: !!s.hasTouch, deviceScaleFactor: 1, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`[${s.name}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${s.name}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${s.name}] request failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[${s.name}] HTTP ${r.status()}: ${r.url()}`); });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#wake-btn:visible', { timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${s.name}-0-boot.png` });
  await page.click('#wake-btn');
  await page.waitForTimeout(1500);

  const tap = async (sel) => { const el = page.locator(sel).first(); if (await el.isVisible()) { await el.click({ force: true }); await page.waitForTimeout(400); } };
  await page.screenshot({ path: `${OUT}/${s.name}-1-hero.png` });
  await tap('#pip');
  await tap('.letter');
  await page.locator('#tb-theme').click({ force: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${s.name}-1a-bath.png` });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/${s.name}-1b-hero-day.png` });
  await tap('#tb-theme');
  await tap('#start-btn');
  await page.screenshot({ path: `${OUT}/${s.name}-2-start.png` });
  await page.keyboard.press('Escape');

  const sections = ['about', 'story', 'dome', 'workshop', 'route', 'guestbook', 'dawn'];
  for (const id of sections) {
    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${s.name}-3-${id}.png` });
  }
  // beat 2 (hands) and the dark room specifically
  await page.evaluate(() => document.querySelector('[data-beat="2"]')?.scrollIntoView());
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${OUT}/${s.name}-4-hands.png` });
  await page.evaluate(() => document.querySelector('.room-dark')?.scrollIntoView());
  await page.waitForTimeout(600);
  await tap('.light-all');
  await page.screenshot({ path: `${OUT}/${s.name}-5-lamps.png` });

  // Lullaby Lab
  await page.evaluate(() => document.querySelector('[data-room="lab"]')?.scrollIntoView());
  await page.waitForTimeout(500);
  await tap('[data-room="lab"] .os-button[data-open]');
  await page.waitForTimeout(700);
  await tap('.win [data-wind]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${s.name}-7-lab.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Secret Crib via the portal, then via SILENCE (desktop)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await tap('.portal-ring');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${OUT}/${s.name}-8-crib.png` });
  await tap('.crib [data-play]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  if (!s.isMobile) { await page.keyboard.type('silence'); await page.waitForTimeout(1600); await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

  // Bad Dream Mode: confirm, squish, clean
  await tap('#start-btn');
  await tap('.sm-item:has-text("totally_not_a_nightmare")');
  await tap('.chaos-dialog [data-yes]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${s.name}-9-chaos.png` });
  for (const b of await page.locator('.blob').all()) { await b.click({ force: true }); await page.waitForTimeout(150); }
  await page.waitForSelector('.chaos-av', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}-9b-antivirus.png` });
  await tap('.chaos-av [data-clean]');
  await page.waitForTimeout(1500);
  if (await page.locator('.chaos-layer').count()) problems.push(`[${s.name}] chaos did not end`);

  // Delivery route: scroll through the pinned flight
  await page.evaluate(() => document.getElementById('route')?.scrollIntoView());
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, s.height * 0.8);
  await page.evaluate((h) => window.scrollBy(0, h * 0.7), s.height);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${s.name}-11-route-flight.png` });

  // Mixtape
  await tap('#start-btn');
  await tap('.sm-item:has-text("Mixtape")');
  await page.waitForTimeout(500);
  await tap('.mix [data-play]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${s.name}-10-mixtape.png` });
  await tap('.mix [data-play]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Settings window
  await tap('#start-btn');
  const settings = page.locator('.sm-item', { hasText: 'Settings' });
  if (await settings.isVisible()) { await settings.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${s.name}-6-settings.png` }); await page.keyboard.press('Escape'); }

  // horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`[${s.name}] horizontal overflow: ${overflow}px`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`✗ ${problems.length} problem(s):\n` + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('✓ clean: no console errors, failed requests or overflow at 3 sizes');

// Runs axe-core on the woken page (desktop + phone, reduced motion) and lists violations.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let total = 0;
for (const v of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'phone', w: 390, h: 844, m: true }]) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, isMobile: !!v.m, hasTouch: !!v.m, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('#wake-btn:visible');
  await page.keyboard.press('Enter'); // wake by keyboard
  await page.waitForTimeout(800);
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  for (const vio of res.violations) {
    total++;
    console.log(`[${v.n}] ${vio.impact} ${vio.id}: ${vio.help} (${vio.nodes.length})`);
    vio.nodes.slice(0, 4).forEach((n) => console.log('    ', n.target.join(' '), '|', (n.failureSummary || '').split('\n')[1]?.trim()));
  }
  await ctx.close();
}
await browser.close();
console.log(total ? `✗ ${total} violation type(s)` : '✓ axe: no WCAG A/AA violations');
process.exit(total ? 1 : 0);

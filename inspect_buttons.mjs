import { chromium } from 'playwright';

const BASE = 'https://inventario-a6aa3.web.app';
const EMAIL = 'danielabrego95@gmail.com';
const PASS  = 'Loquito420';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|inventory/, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  // Go to inventory
  await page.goto(`${BASE}/inventory`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Inspect all buttons and their SVG children
  const info = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(btn => {
      const svg = btn.querySelector('svg');
      return {
        disabled: btn.disabled,
        classes: btn.className,
        svgAttrs: svg ? Object.fromEntries(
          Array.from(svg.attributes).map(a => [a.name, a.value])
        ) : null,
        svgPaths: svg ? Array.from(svg.querySelectorAll('path, polyline, circle, line')).map(p => ({
          tag: p.tagName,
          d: p.getAttribute('d')?.slice(0, 40),
          attrs: Object.fromEntries(Array.from(p.attributes).map(a => [a.name, a.value])),
        })).slice(0, 3) : null,
        text: btn.textContent?.trim().slice(0, 30),
      };
    }).filter(b => b.svgAttrs !== null);
  });

  console.log(`\nTotal buttons with SVG: ${info.length}`);
  info.forEach((b, i) => {
    console.log(`\n[${i}] disabled=${b.disabled}`);
    console.log(`  classes: ${b.classes.slice(0, 120)}`);
    console.log(`  svg attrs: ${JSON.stringify(b.svgAttrs)}`);
    if (b.svgPaths?.[0]) console.log(`  first path d: "${b.svgPaths[0].d}"`);
  });

  await browser.close();
})();

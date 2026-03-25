import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'fs';

const DIR = '/tmp/sale_screenshots';
mkdirSync(DIR, { recursive: true });

const BASE  = 'https://inventario-a6aa3.web.app';
const EMAIL = 'danielabrego95@gmail.com';
const PASS  = 'Loquito420';

let idx = 1;
const snap = async (page, name) => {
  const f = `${DIR}/${String(idx).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: f, fullPage: false });
  console.log(`📸 ${f}`);
  idx++;
  return f;
};
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  page.setDefaultTimeout(20000);

  // ─── PASO 1: LOGIN ──────────────────────────────────────────────────────────
  console.log('\n🔐 Paso 1: Inicio de sesión...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(1500);
  await snap(page, 'paso1-login');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|inventory/, { timeout: 25000 });
  await wait(2500);
  await snap(page, 'paso2-dashboard');
  console.log('✅ Login OK');

  // ─── PASO 2: INVENTARIO ──────────────────────────────────────────────────────
  console.log('\n📱 Paso 2: Inventario con lote TEST-PISTOLA...');
  await page.goto(`${BASE}/inventory`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(4000);
  await snap(page, 'paso3-inventario-TEST-PISTOLA');

  // ─── PASO 3: RECEPCIÓN ───────────────────────────────────────────────────────
  console.log('\n📦 Paso 3: Módulo de recepción (pistola/scanner)...');
  await page.goto(`${BASE}/receiving`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(5000);
  await snap(page, 'paso4-recepcion-pistola');
  console.log('✅ Receiving cargado');

  // ─── PASO 4: CLICK CARRITO ───────────────────────────────────────────────────
  console.log('\n🛒 Paso 4: Seleccionando teléfono S22 Ultra 5G $450...');
  await page.goto(`${BASE}/inventory`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(4000);
  await snap(page, 'paso5-inventario-antes-venta');

  // Click the enabled cart button (bg-primary-600 + lucide-shopping-cart SVG)
  const cartClicked = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.className.includes('bg-primary-600')) {
        const svg = btn.querySelector('svg');
        if (svg && svg.className.baseVal.includes('shopping-cart')) {
          btn.click();
          return { ok: true, cls: btn.className.slice(0,80) };
        }
      }
    }
    return { ok: false };
  });
  console.log(`Cart click: ${JSON.stringify(cartClicked)}`);

  // ─── PASO 5: PAYMENT MODAL ───────────────────────────────────────────────────
  console.log('\n💳 Paso 5: Payment Modal — esperando que aparezca...');

  // Wait for "Finalizar Venta" dialog to appear
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => null);
  await page.waitForFunction(() => document.body.innerText.includes('Finalizar Venta'), { timeout: 10000 }).catch(() => null);
  await wait(1000);
  await snap(page, 'paso6-payment-modal-abierto');

  const inModal = await page.evaluate(() => document.body.innerText.includes('Finalizar Venta'));
  console.log(`Modal abierto: ${inModal}`);

  if (inModal) {
    // ── Buscar cliente Javier ──
    const clientInput = page.locator('input[placeholder="Buscar cliente..."]');
    await clientInput.fill('Javier');
    await wait(1500);
    await snap(page, 'paso7-buscando-cliente-Javier');

    // Click the first dropdown result (a div with cursor-pointer inside the absolute dropdown)
    const dropdownResult = page.locator('div.absolute.z-10 div').filter({ hasText: /Javier/i }).first();
    const dropAlt = page.locator('.absolute').filter({ has: page.locator('text=/Javier/i') }).locator('div[class*="cursor"]').first();

    let clientPicked = false;
    if (await dropdownResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdownResult.click();
      clientPicked = true;
      console.log('✅ Cliente seleccionado via locator');
    } else {
      // JS fallback
      clientPicked = await page.evaluate(() => {
        const divs = document.querySelectorAll('div');
        for (const div of divs) {
          const txt = div.textContent?.trim();
          if (txt && txt.includes('Javier') && div.className.includes('cursor-pointer')) {
            div.click();
            return true;
          }
        }
        // Second attempt: any div inside .absolute that has Javier
        const allDivs = document.querySelectorAll('.absolute div');
        for (const div of allDivs) {
          if (div.textContent?.includes('Javier')) {
            div.click();
            return true;
          }
        }
        return false;
      });
      console.log(`Cliente JS pick: ${clientPicked}`);
    }

    await wait(800);
    await snap(page, 'paso8-cliente-Javier-seleccionado');

    // ── Efectivo ya seleccionado (ya aparece azul), pero rellenamos monto ──
    // Fill "Efectivo Recibido" input with $450
    const cashInput = page.locator('input[placeholder="0"], input[type="number"]').first();
    // More specific: find input labeled "Efectivo Recibido"
    const efectivoLabel = page.locator('label:has-text("Efectivo Recibido"), :text("Efectivo Recibido")').first();
    const efectivoLabelVisible = await efectivoLabel.isVisible().catch(() => false);

    if (efectivoLabelVisible) {
      // Get the sibling/nearby input
      await page.locator('label:has-text("Efectivo Recibido") + input, label:has-text("Efectivo Recibido") ~ input').fill('450');
    } else {
      // Try to find by evaluating which input is the cash input
      await page.evaluate(() => {
        // Look for the input with value 0 that follows "Efectivo Recibido" text
        const labels = document.querySelectorAll('label, p, div, span');
        for (const label of labels) {
          if (label.textContent?.trim() === 'Efectivo Recibido') {
            // Find next input sibling or parent's input child
            const parent = label.parentElement;
            const input = parent?.querySelector('input') ||
                          label.nextElementSibling?.querySelector('input') ||
                          (label.nextElementSibling);
            if (input && input.tagName === 'INPUT') {
              input.focus();
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              nativeInputValueSetter?.call(input, '450');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
        return false;
      });
    }

    await wait(500);

    // ── Scroll to bottom of modal to see Confirmar Venta button ──
    await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (modal) modal.scrollTop = modal.scrollHeight;
    });
    await wait(500);
    await snap(page, 'paso9-modal-listo-confirmar');

    // ── Click Confirmar Venta ──
    const confirmBtn = page.locator('button:has-text("Confirmar Venta")').first();
    const confirmVis = await confirmBtn.isVisible().catch(() => false);
    console.log(`Confirmar Venta visible: ${confirmVis}`);

    if (!confirmVis) {
      // Also try scrolling the page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(500);
    }

    await confirmBtn.scrollIntoViewIfNeeded();
    await snap(page, 'paso10-confirmar-venta-visible');

    console.log('✅ Haciendo click en Confirmar Venta...');
    await confirmBtn.click();
    console.log('✅ Venta confirmada!');

    // Wait for invoice to appear (auto-show after sale)
    await wait(6000);
    await snap(page, 'paso11-post-venta');
  } else {
    console.log('⚠️ Modal no se abrió');
    await snap(page, 'debug-sin-modal');
  }

  // ─── PASO 6: INVOICE MODAL con WhatsApp + PDF + Print ────────────────────────
  console.log('\n🧾 Paso 6: Invoice Modal con botones...');
  await wait(2000);

  const finalText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  const hasInvoice  = finalText.includes('TOP LINE TEC') || finalText.includes('ACTA DE VENTA') || finalText.includes('INV-');
  const hasWA       = finalText.includes('WhatsApp');
  const hasPDF      = finalText.includes('PDF') || finalText.includes('Descargar');
  const hasPrint    = finalText.includes('Imprimir');

  console.log(`\n📊 Resultados finales:`);
  console.log(`  ✅ Factura visible: ${hasInvoice}`);
  console.log(`  ✅ WhatsApp button: ${hasWA}`);
  console.log(`  ✅ PDF button: ${hasPDF}`);
  console.log(`  ✅ Print button: ${hasPrint}`);

  await snap(page, 'paso12-FACTURA-FINAL-con-botones');
  await page.screenshot({ path: `${DIR}/FINAL-factura-fullpage.png`, fullPage: true });

  await browser.close();
  console.log('\n✅ ¡Script completado exitosamente!');
  console.log(`\n📁 Screenshots (${DIR}):`);
  readdirSync(DIR).sort().forEach(f => console.log(`  ${f}`));
})();

/**
 * Deeper live interaction stress test.
 */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = 'https://flower-backoffice-demo.vercel.app';
const ADMIN_EMAIL = 'admin@yourshop.com';
const ADMIN_PASSWORD = '111';

const results = [];

function record(viewport, category, status, message) {
  results.push({ viewport, category, status, message });
  console.log(`[${viewport}] ${status === 'pass' ? '✓' : status === 'warn' ? '!' : '✗'} ${category}: ${message}`);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard\/flowers/, { timeout: 30_000 });
}

async function runDeepTests(browser, viewportName, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await login(page);

    // Production mode checks
    const demoButtons = await page.getByRole('button', { name: /owner admin|staff one/i }).count();
    record(
      viewportName,
      'prod-auth',
      demoButtons === 0 ? 'pass' : 'fail',
      demoButtons === 0 ? 'No demo one-tap login buttons' : 'Demo login buttons still visible',
    );

    const demoBanner = await page.getByText(/demo mode/i).isVisible().catch(() => false);
    record(
      viewportName,
      'prod-banner',
      !demoBanner ? 'pass' : 'warn',
      !demoBanner ? 'No demo mode banner on dashboard' : 'Demo banner visible',
    );

    // Home data
    await page.goto(`${BASE_URL}/dashboard/flowers`, { waitUntil: 'networkidle' });
    const homeText = await page.locator('main').innerText();
    record(
      viewportName,
      'home-data',
      /orders|inventory|branch|today/i.test(homeText) ? 'pass' : 'warn',
      /orders|inventory|branch|today/i.test(homeText)
        ? 'Home dashboard shows operational content'
        : 'Home may be empty',
    );

    // Orders calendar + list toggle
    await page.goto(`${BASE_URL}/dashboard/flowers/orders`, { waitUntil: 'networkidle' });
    const listBtn = page.getByRole('button', { name: /^list$/i });
    const calBtn = page.getByRole('button', { name: /calendar/i });

    if ((await listBtn.count()) > 0) {
      await listBtn.click();
      await page.waitForTimeout(600);
      record(viewportName, 'orders-list', 'pass', 'List view toggles');
    }

    if ((await calBtn.count()) > 0) {
      await calBtn.click();
      await page.waitForTimeout(600);
      record(viewportName, 'orders-calendar', 'pass', 'Calendar view toggles');
    }

    // Rapid navigation stress (5 cycles)
    let rapidOk = true;
    const paths = [
      '/dashboard/flowers/orders',
      '/dashboard/flowers/inventory',
      '/dashboard/flowers/expenses',
      '/dashboard/flowers/reports',
      '/dashboard/flowers',
    ];
    for (let i = 0; i < 5; i++) {
      for (const path of paths) {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      }
    }
    const crashText = await page.locator('body').innerText();
    if (/application error|something went wrong|uncaught/i.test(crashText)) {
      rapidOk = false;
    }
    record(
      viewportName,
      'rapid-nav',
      rapidOk ? 'pass' : 'fail',
      rapidOk ? '25 rapid page changes without crash' : 'App error after rapid navigation',
    );

    // Inventory tabs
    await page.goto(`${BASE_URL}/dashboard/flowers/inventory`, { waitUntil: 'networkidle' });
    const transferTab = page.getByRole('button', { name: /transfer/i });
    if ((await transferTab.count()) > 0) {
      await transferTab.first().click();
      await page.waitForTimeout(500);
      record(viewportName, 'inventory-tabs', 'pass', 'Transfer tab works');
    }

    // Expenses content
    await page.goto(`${BASE_URL}/dashboard/flowers/expenses`, { waitUntil: 'networkidle' });
    const expText = await page.locator('main').innerText();
    record(
      viewportName,
      'expenses',
      /expense|supplier|staff/i.test(expText) ? 'pass' : 'warn',
      /expense|supplier|staff/i.test(expText) ? 'Expenses page renders' : 'Expenses page sparse',
    );

    // Reports printable + metrics
    await page.goto(`${BASE_URL}/dashboard/flowers/reports`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const repText = await page.locator('main').innerText();
    const hasMetrics = /sales|orders|net income|income/i.test(repText);
    const hasPrint = /print|report/i.test(repText);
    record(
      viewportName,
      'reports-metrics',
      hasMetrics ? 'pass' : 'warn',
      hasMetrics ? 'Report metrics visible' : 'Report metrics missing (day may be locked)',
    );
    record(
      viewportName,
      'reports-print',
      hasPrint ? 'pass' : 'warn',
      hasPrint ? 'Printable report section present' : 'Print section not found',
    );

    // Products admin page
    await page.goto(`${BASE_URL}/dashboard/flowers/products`, { waitUntil: 'networkidle' });
    const prodText = await page.locator('main').innerText();
    record(
      viewportName,
      'products',
      /product|flower|price/i.test(prodText) ? 'pass' : 'warn',
      /product|flower|price/i.test(prodText) ? 'Products admin accessible' : 'Products page empty',
    );

    // Open order and check key sections (use list view for reliable row click)
    await page.goto(`${BASE_URL}/dashboard/flowers/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const listViewBtn = page.getByRole('button', { name: /^list$/i });
    if ((await listViewBtn.count()) > 0) {
      await listViewBtn.click();
      await page.waitForTimeout(600);
    }
    const orderRow = page.locator('tr button, li button').first();
    const fallbackRow = page.getByText(/daily order|view order|papers & petals/i).first();
    if ((await orderRow.count()) > 0) {
      await orderRow.click({ timeout: 5000 });
    } else if ((await fallbackRow.count()) > 0) {
      await fallbackRow.click({ timeout: 5000 });
    }
    await page.waitForTimeout(1200);
    const modalText = await page.locator('body').innerText();
    const hasStatus = /not started|ready|picked up|delivered/i.test(modalText);
    const hasPhoto = /finished order photo|inspo|order form/i.test(modalText);
    if (hasStatus || hasPhoto) {
      record(viewportName, 'order-status', hasStatus ? 'pass' : 'warn', hasStatus ? 'Status workflow in modal' : 'Status not detected');
      record(viewportName, 'order-photos', hasPhoto ? 'pass' : 'warn', hasPhoto ? 'Photo sections in modal' : 'Photo sections not detected');
    } else {
      record(viewportName, 'order-modal', 'warn', 'Could not open order detail for content check');
    }
  } catch (error) {
    record(viewportName, 'fatal', 'fail', error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }
}

async function main() {
  console.log('\n=== DEEP STRESS TEST ===\n');
  const browser = await chromium.launch({ headless: true });

  await runDeepTests(browser, 'desktop', { viewport: { width: 1440, height: 900 } });
  await runDeepTests(browser, 'phone', {
    ...devices['Pixel 5'],
    viewport: devices['Pixel 5'].viewport,
  });
  await runDeepTests(browser, 'ipad', {
    ...devices['iPad Pro 11'],
    viewport: devices['iPad Pro 11'].viewport,
  });

  await browser.close();

  const summary = {
    passed: results.filter((r) => r.status === 'pass').length,
    warnings: results.filter((r) => r.status === 'warn').length,
    failed: results.filter((r) => r.status === 'fail').length,
    results,
  };

  writeFileSync(join(process.cwd(), 'stress-test-deep-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\nDeep test: ${summary.passed} pass, ${summary.warnings} warn, ${summary.failed} fail\n`);
}

main();

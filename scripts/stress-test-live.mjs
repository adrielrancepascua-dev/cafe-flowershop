/**
 * Live stress test — desktop, phone, iPad viewports.
 * Usage: node scripts/stress-test-live.mjs
 */
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.STRESS_TEST_URL || 'https://flower-backoffice-demo.vercel.app';
const ADMIN_EMAIL = process.env.STRESS_TEST_EMAIL || 'admin@yourshop.com';
const ADMIN_PASSWORD = process.env.STRESS_TEST_PASSWORD || '111';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  {
    name: 'phone',
    width: devices['Pixel 5'].viewport.width,
    height: devices['Pixel 5'].viewport.height,
    userAgent: devices['Pixel 5'].userAgent,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'ipad',
    width: devices['iPad Pro 11'].viewport.width,
    height: devices['iPad Pro 11'].viewport.height,
    userAgent: devices['iPad Pro 11'].userAgent,
    isMobile: true,
    hasTouch: true,
  },
];

const ROUTES = [
  { path: '/dashboard/flowers', label: 'Home' },
  { path: '/dashboard/flowers/orders', label: 'Orders' },
  { path: '/dashboard/flowers/inventory', label: 'Inventory' },
  { path: '/dashboard/flowers/expenses', label: 'Expenses' },
  { path: '/dashboard/flowers/reports', label: 'Reports' },
  { path: '/dashboard/flowers/products', label: 'Products' },
];

const results = [];

function record(viewport, category, status, message, extra = {}) {
  results.push({ viewport, category, status, message, ...extra });
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '!' : '✗';
  console.log(`[${viewport}] ${icon} ${category}: ${message}`);
}

async function checkHorizontalOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const clientWidth = doc.clientWidth;
    return {
      scrollWidth,
      clientWidth,
      hasOverflow: scrollWidth > clientWidth + 2,
      diff: scrollWidth - clientWidth,
    };
  });

  if (overflow.hasOverflow) {
    record(
      viewport,
      'layout',
      'fail',
      `${label}: horizontal overflow (+${overflow.diff}px, ${overflow.scrollWidth}/${overflow.clientWidth})`,
    );
    return false;
  }

  record(viewport, 'layout', 'pass', `${label}: no horizontal overflow`);
  return true;
}

async function login(page, viewport) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard\/flowers/, { timeout: 30_000 });
  const url = page.url();
  if (!url.includes('/dashboard/flowers')) {
    throw new Error(`Login failed — landed on ${url}`);
  }
  record(viewport, 'auth', 'pass', 'Admin login succeeded');
}

async function testViewport(browser, viewportConfig) {
  const { name: viewport } = viewportConfig;
  const context = await browser.newContext({
    viewport: { width: viewportConfig.width, height: viewportConfig.height },
    userAgent: viewportConfig.userAgent,
    isMobile: viewportConfig.isMobile ?? false,
    hasTouch: viewportConfig.hasTouch ?? false,
  });
  const page = await context.newPage();
  const screenshotDir = join(process.cwd(), 'stress-test-screenshots', viewport);
  mkdirSync(screenshotDir, { recursive: true });

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`);
  });

  try {
    await login(page, viewport);
    await checkHorizontalOverflow(page, viewport, 'Home after login');

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(800);

      const title = await page.title();
      if (!title.includes('Papers')) {
        record(viewport, 'navigation', 'warn', `${route.label}: unexpected title "${title}"`);
      } else {
        record(viewport, 'navigation', 'pass', `${route.label} loaded`);
      }

      const ok = await checkHorizontalOverflow(page, viewport, route.label);
      if (!ok) {
        await page.screenshot({
          path: join(screenshotDir, `${route.label.replace(/\s+/g, '-').toLowerCase()}-overflow.png`),
          fullPage: true,
        });
      }
    }

    // Orders — open first order if any
    await page.goto(`${BASE_URL}/dashboard/flowers/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const orderButtons = page.locator('button, [role="button"]').filter({ hasText: /view|edit|order/i });
    const orderCount = await orderButtons.count();
    if (orderCount > 0) {
      await orderButtons.first().click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(1200);
      const modalVisible = await page.getByText(/view order|edit order|daily order/i).first().isVisible().catch(() => false);
      if (modalVisible) {
        record(viewport, 'orders', 'pass', 'Order modal opens');
        await checkHorizontalOverflow(page, viewport, 'Order modal');
        await page.screenshot({ path: join(screenshotDir, 'order-modal.png'), fullPage: true });
        await page.keyboard.press('Escape').catch(() => null);
        await page.getByRole('button', { name: /close/i }).first().click({ timeout: 3000 }).catch(() => null);
      } else {
        record(viewport, 'orders', 'warn', 'Could not confirm order modal opened');
      }
    } else {
      record(viewport, 'orders', 'warn', 'No orders found to open modal');
    }

    // Mobile nav visibility on small screens
    if (viewport === 'phone' || viewport === 'ipad') {
      const mobileNav = page.locator('nav').filter({ hasText: /orders/i }).last();
      const navVisible = await mobileNav.isVisible().catch(() => false);
      record(
        viewport,
        'mobile-nav',
        navVisible ? 'pass' : 'fail',
        navVisible ? 'Bottom navigation visible' : 'Bottom navigation not found',
      );
    }

    // Reports printable section
    await page.goto(`${BASE_URL}/dashboard/flowers/reports`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const reportText = await page.locator('body').innerText();
    if (/sales report|printable|reports/i.test(reportText)) {
      record(viewport, 'reports', 'pass', 'Reports content renders');
    } else {
      record(viewport, 'reports', 'warn', 'Reports page may be empty or locked');
    }

    const criticalConsole = consoleErrors.filter(
      (e) => !/favicon|404|net::ERR|devtools/i.test(e),
    );
    if (criticalConsole.length > 0) {
      record(viewport, 'console', 'warn', `${criticalConsole.length} console error(s)`, {
        errors: criticalConsole.slice(0, 5),
      });
    } else {
      record(viewport, 'console', 'pass', 'No critical console errors');
    }

    if (failedRequests.length > 0) {
      const authOrApi = failedRequests.filter((r) => /supabase|api/i.test(r));
      record(
        viewport,
        'network',
        authOrApi.length > 0 ? 'fail' : 'warn',
        `${failedRequests.length} failed request(s)`,
        { requests: failedRequests.slice(0, 5) },
      );
    } else {
      record(viewport, 'network', 'pass', 'No failed network requests');
    }
  } catch (error) {
    record(viewport, 'fatal', 'fail', error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: join(screenshotDir, 'fatal-error.png'), fullPage: true }).catch(() => null);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`\nStress testing ${BASE_URL}\n`);
  const browser = await chromium.launch({ headless: true });

  for (const viewport of VIEWPORTS) {
    console.log(`\n--- ${viewport.name.toUpperCase()} (${viewport.width}x${viewport.height}) ---\n`);
    await testViewport(browser, viewport);
  }

  await browser.close();

  const summary = {
    testedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewports: VIEWPORTS.map((v) => v.name),
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    warnings: results.filter((r) => r.status === 'warn').length,
    failed: results.filter((r) => r.status === 'fail').length,
    results,
  };

  const outPath = join(process.cwd(), 'stress-test-results.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(`Pass: ${summary.passed} | Warn: ${summary.warnings} | Fail: ${summary.failed}`);
  console.log(`Full report: ${outPath}`);
  console.log('=============================\n');

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

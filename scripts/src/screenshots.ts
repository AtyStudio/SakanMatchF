/**
 * SakanMatch Screenshot Generator
 * ================================
 * Captures high-quality screenshots of https://sakanmatch.site/ for
 * presentations and marketing materials.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run screenshots
 *
 * Optional env vars:
 *   SCREENSHOT_EMAIL     - Account email for authenticated pages
 *   SCREENSHOT_PASSWORD  - Account password for authenticated pages
 *   BASE_URL             - Override base URL (default: https://sakanmatch.site)
 *   OUTPUT_DIR           - Override output folder (default: ./screenshots)
 *
 * Outputs:
 *   Desktop (1440×900): home, listings, listing-details, auth,
 *                        dashboard, messaging, premium
 *   Mobile  (375×812):  home-mobile, listings-mobile
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "") ?? "https://sakanmatch.site";
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "screenshots");
const EMAIL = process.env.SCREENSHOT_EMAIL ?? "";
const PASSWORD = process.env.SCREENSHOT_PASSWORD ?? "";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

interface ScreenshotConfig {
  name: string;
  path: string;
  viewport: { width: number; height: number };
  requiresAuth?: boolean;
  scrollY?: number;
  waitExtra?: number;
}

const SCREENSHOTS: ScreenshotConfig[] = [
  { name: "home.png",             path: "/",        viewport: DESKTOP },
  { name: "home-mobile.png",      path: "/",        viewport: MOBILE },
  { name: "listings.png",         path: "/",        viewport: DESKTOP, scrollY: 800 },
  { name: "listings-mobile.png",  path: "/",        viewport: MOBILE,  scrollY: 600 },
  { name: "listing-details.png",  path: "/__first_listing__", viewport: DESKTOP },
  { name: "auth.png",             path: "/login",   viewport: DESKTOP },
  { name: "premium.png",          path: "/premium", viewport: DESKTOP },
  { name: "dashboard.png",        path: "/dashboard", viewport: DESKTOP, requiresAuth: true },
  { name: "messaging.png",        path: "/messages",  viewport: DESKTOP, requiresAuth: true },
];

async function dismissOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selectors = [
      "[class*='cookie']", "[class*='banner']", "[class*='overlay']",
      "[class*='modal']",  "[class*='popup']",  "[id*='cookie']",
      "[id*='banner']",    "[id*='overlay']",
    ];
    for (const sel of selectors) {
      document.querySelectorAll<HTMLElement>(sel).forEach(el => {
        el.style.display = "none";
      });
    }
  });
}

async function waitForPage(page: Page, extraMs = 0): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000 + extraMs);
  await dismissOverlays(page);
}

async function login(page: Page): Promise<boolean> {
  if (!EMAIL || !PASSWORD) {
    console.warn("  ⚠  SCREENSHOT_EMAIL / SCREENSHOT_PASSWORD not set — skipping auth.");
    return false;
  }
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const url = page.url();
  const success = !url.includes("/login");
  if (!success) console.warn("  ⚠  Login may have failed — continuing anyway.");
  return success;
}

async function getFirstListingUrl(page: Page): Promise<string | null> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const href = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("a[href*='/listing']"));
    return cards.length > 0 ? (cards[0] as HTMLAnchorElement).href : null;
  });
  return href;
}

async function takeScreenshot(
  context: BrowserContext,
  cfg: ScreenshotConfig,
  isLoggedIn: boolean,
  firstListingUrl: string | null,
): Promise<void> {
  const page = await context.newPage();
  await page.setViewportSize(cfg.viewport);

  try {
    if (cfg.requiresAuth && !isLoggedIn) {
      console.log(`  → Skipping ${cfg.name} (auth required, credentials missing)`);
      await page.close();
      return;
    }

    let targetUrl = `${BASE_URL}${cfg.path}`;
    if (cfg.path === "/__first_listing__") {
      if (firstListingUrl) {
        targetUrl = firstListingUrl;
      } else {
        console.log(`  → Skipping ${cfg.name} (no listing found)`);
        await page.close();
        return;
      }
    }

    console.log(`  → Capturing ${cfg.name} from ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    await waitForPage(page, cfg.waitExtra ?? 0);

    if (cfg.scrollY && cfg.scrollY > 0) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), cfg.scrollY);
      await page.waitForTimeout(800);
      await dismissOverlays(page);
    }

    const outPath = path.join(OUTPUT_DIR, cfg.name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  ✓  Saved ${cfg.name}`);
  } catch (err) {
    console.error(`  ✗  Failed ${cfg.name}:`, err);
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\nSakanMatch Screenshot Generator`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Output   : ${OUTPUT_DIR}`);
  console.log(`Screens  : ${SCREENSHOTS.length}\n`);

  const browser: Browser = await chromium.launch({ headless: true });

  let isLoggedIn = false;
  let authContext: BrowserContext | null = null;
  let firstListingUrl: string | null = null;

  const publicContext = await browser.newContext();

  const probePage = await publicContext.newPage();
  await probePage.setViewportSize(DESKTOP);
  firstListingUrl = await getFirstListingUrl(probePage);
  await probePage.close();

  if (EMAIL && PASSWORD) {
    authContext = await browser.newContext();
    const loginPage = await authContext.newPage();
    await loginPage.setViewportSize(DESKTOP);
    isLoggedIn = await login(loginPage);
    await loginPage.close();
  }

  for (const cfg of SCREENSHOTS) {
    const ctx = cfg.requiresAuth && authContext ? authContext : publicContext;
    await takeScreenshot(ctx, cfg, isLoggedIn, firstListingUrl);
  }

  await publicContext.close();
  if (authContext) await authContext.close();
  await browser.close();

  console.log(`\nDone! Screenshots saved to: ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

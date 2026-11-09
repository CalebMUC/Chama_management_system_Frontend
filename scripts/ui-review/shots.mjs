#!/usr/bin/env node
// UI review harness (dev only). Screenshots key screens against `npm run dev` with the API mocked, so the UI can be compared
// before and after a change without a backend.
//
//   npm run ui:shots -- --label before
//   npm run ui:shots -- --label after --only home,chama --themes light --widths 1440
//   npm run ui:shots -- --label after --audit        # also checks truncated amounts and horizontal overflow
//
// Uses the installed Chrome (or Edge) through Playwright, so no browser download is needed.
// Output: scripts/ui-review/out/<label>/<screen>-<width>-<theme>.png, plus report.json.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolve } from './fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

// ---- Arguments ----------------------------------------------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const label = arg('label');
if (!label || label === true) {
  console.error('Usage: npm run ui:shots -- --label <name> [--only a,b] [--widths 1440,390] [--themes light,dark] [--audit] [--base URL]');
  process.exit(1);
}
const base = String(arg('base', 'http://localhost:3000'));
const only = arg('only') ? String(arg('only')).split(',') : null;
const audit = !!arg('audit', false);
const themes = String(arg('themes', 'light,dark')).split(',');
const widths = String(arg('widths', audit ? '1280,1440,1920,390' : '1440,390')).split(',').map(Number);
const HEIGHT = { 390: 844 };
const outDir = path.join(here, 'out', label);
mkdirSync(outDir, { recursive: true });

// ---- Screens ------------------------------------------------------------------------------------------------------------

/** @type {{ name: string; path: string; anonymous?: boolean; flow?: (page: import('playwright').Page, shot: (suffix: string) => Promise<void>) => Promise<void> }[]} */
const screens = [
  { name: 'login', path: '/login?chama=umoja', anonymous: true },
  { name: 'home', path: '/home' },
  { name: 'chama', path: '/chama' },
  { name: 'contributions', path: '/contributions' },
  { name: 'loans', path: '/loans' },
  { name: 'journal', path: '/ledger/journal' },
  { name: 'statement', path: '/me/statement' },
  { name: 'loan-detail', path: '/loans/loan-0001' },
  { name: 'record-contribution', path: '/contributions/new', flow: recordContribution },
];

/** Fills the Record contribution form, then walks through review/confirm (when the UI has it) to the result. */
async function recordContribution(page, shot) {
  await shot('1-empty');
  await page.getByRole('button', { name: /choose a member/i }).first().click();
  await page.getByRole('textbox', { name: /search members/i }).fill('Wanjiku');
  await page.getByRole('option', { name: /Grace Wanjiku/ }).click();
  await page.getByLabel(/^amount/i).first().fill('5000');
  await page.getByLabel(/m-pesa code/i).fill('QKX7H2L9P1');
  await page.waitForTimeout(300);
  await shot('2-filled');
  await page.getByRole('button', { name: /^(review|record contribution|continue)/i }).last().click();
  const confirm = page.getByRole('button', { name: /^confirm/i });
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.waitForTimeout(300);
    await shot('3-review');
    await confirm.click();
  }
  await page.getByText(/recorded/i).first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot('4-result');
}

// ---- Dev server ---------------------------------------------------------------------------------------------------------

async function up() {
  try {
    const res = await fetch(`${base}/login`, { redirect: 'manual' });
    return res.status < 500;
  } catch {
    return false;
  }
}

let server = null;
async function ensureServer() {
  if (await up()) return;
  if (!base.includes('localhost:3000')) throw new Error(`Nothing is listening on ${base}`);
  console.log('Starting npm run dev …');
  server = spawn('npm', ['run', 'dev'], { cwd: root, shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? 'development' } });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await up()) return;
  }
  throw new Error('The dev server did not start within 2 minutes');
}
function stopServer() {
  if (!server) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill('SIGTERM');
  } catch {
    /* already gone */
  }
}

// ---- Browser ------------------------------------------------------------------------------------------------------------

async function launch() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try the next one */
    }
  }
  throw new Error('No Chromium browser found. Install Chrome or run: npx playwright install chromium');
}

const unmocked = new Set();

async function newPage(browser, { width, theme, anonymous }) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 900 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    isMobile: width < 640,
    hasTouch: width < 640,
    locale: 'en-KE',
    timezoneId: 'Africa/Nairobi',
  });
  const session = {
    accessToken: 'mock-access-token',
    accessTokenExpiresAt: Date.now() + 24 * 3_600_000,
    refreshToken: 'mock-refresh-token',
    refreshTokenExpiresAt: Date.now() + 7 * 24 * 3_600_000,
    chamaCode: 'umoja',
    isPlatformAdmin: false,
  };
  const preferences = { state: { theme, sidebarCollapsed: false, licenceBannerDismissed: null }, version: 0 };
  await context.addInitScript(
    ([s, p, anon]) => {
      try {
        if (!anon) localStorage.setItem('chama.session', JSON.stringify(s));
        localStorage.setItem('chama.lastChamaCode', 'umoja');
        if (!localStorage.getItem('chama.preferences')) localStorage.setItem('chama.preferences', JSON.stringify(p));
      } catch {
        /* storage blocked */
      }
    },
    [session, preferences, !!anonymous],
  );
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const apiPath = url.pathname.replace(/^.*\/api\/v1/, '');
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    const hit = resolve(req.method(), apiPath, url.searchParams, body);
    const timestamp = new Date().toISOString();
    if (!hit) {
      unmocked.add(`${req.method()} ${apiPath}`);
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Not mocked', data: null, error: { code: 'NOT_FOUND', status: 404, fields: [] }, timestamp }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: hit.message ?? '', data: hit.data, ...(hit.meta ? { meta: hit.meta } : {}), timestamp }),
    });
  });
  await context.route('**/actuator/health', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"UP"}' }));
  const page = await context.newPage();
  return { context, page };
}

/** Waits for the app to boot and for loading spinners and skeletons to go. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[role="status"], .animate-pulse'), null, { timeout: 30_000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(500);
}

/** Truncated amounts (ellipsis or clipped figures) and page-level horizontal overflow. */
async function auditPage(page) {
  return page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) problems.push(`page overflows horizontally: ${document.documentElement.scrollWidth}px > ${window.innerWidth}px`);
    const money = /\b(KES|Ksh)\b|\d{1,3}(,\d{3})+(\.\d+)?/;
    for (const el of document.querySelectorAll('main *')) {
      if (!(el instanceof HTMLElement) || el.children.length > 2) continue;
      const text = el.textContent?.trim() ?? '';
      if (!money.test(text) || text.length > 40) continue;
      const style = getComputedStyle(el);
      const clips = style.textOverflow === 'ellipsis' || style.overflow === 'hidden' || style.overflowX === 'hidden';
      if (clips && el.scrollWidth > el.clientWidth + 1) problems.push(`truncated amount: "${text}"`);
    }
    return problems;
  });
}

// ---- Run ----------------------------------------------------------------------------------------------------------------

const report = { label, base, takenAt: new Date().toISOString(), shots: [], audit: {}, unmocked: [] };

async function main() {
  await ensureServer();
  const browser = await launch();
  const list = screens.filter((s) => !only || only.includes(s.name));
  try {
    for (const screen of list) {
      for (const width of widths) {
        for (const theme of themes) {
          const tag = `${screen.name}-${width}-${theme}`;
          const { context, page } = await newPage(browser, { width, theme, anonymous: screen.anonymous });
          try {
            await page.goto(`${base}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
            await settle(page);
            const shot = async (suffix) => {
              const file = path.join(outDir, `${suffix ? `${screen.name}-${suffix}` : screen.name}-${width}-${theme}.png`);
              await page.screenshot({ path: file, fullPage: true });
              report.shots.push(path.relative(outDir, file));
            };
            if (audit) {
              const problems = await auditPage(page);
              if (problems.length) report.audit[tag] = problems;
            }
            if (screen.flow && !audit) await screen.flow(page, shot);
            else if (!audit || width === 1440 || width === 390) await shot('');
            console.log(`✓ ${tag}`);
          } catch (e) {
            console.error(`✗ ${tag}: ${e.message.split('\n')[0]}`);
            await page.screenshot({ path: path.join(outDir, `${tag}-ERROR.png`), fullPage: true }).catch(() => {});
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  report.unmocked = [...unmocked].sort();
  writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (report.unmocked.length) console.log(`\nNot mocked (answered 404):\n  ${report.unmocked.join('\n  ')}`);
  if (audit) {
    const n = Object.keys(report.audit).length;
    console.log(n ? `\nAudit: problems on ${n} screen(s):\n${JSON.stringify(report.audit, null, 2)}` : '\nAudit: no truncated amounts or horizontal overflow.');
  }
  console.log(`\n${report.shots.length} screenshots in ${path.relative(root, outDir)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(stopServer);

// Takes the README screenshots (English UI) with the sample photos and song in ./samples.
//
//   npm run screenshots        (builds the app, then runs this)
//
// Writes assets/screenshots/{photos,aspect,export,phones}.png. Needs Google Chrome (MP4 export uses its H.264 encoder).
// To redraw the samples: node tools/screenshots/make-samples.mjs

import { chromium } from 'playwright';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const APP = pathToFileURL(join(ROOT, 'dist/flipreel.html')).href;
const OUT = join(ROOT, 'assets/screenshots');
const SAMPLES = join(HERE, 'samples');
const PHOTOS = ['sunset-beach', 'morning-mountains', 'city-night', 'autumn-forest', 'balloons', 'desert-dunes', 'flower-field', 'lake-moon'].map(
  (n) => join(SAMPLES, `${n}.jpg`),
);
const SONG = join(SAMPLES, 'golden-hour.wav');

const STEP = { photos: 0, aspect: 1, music: 6, export: 7 };

const browser = await chromium.launch({ channel: 'chrome' });

/** A fresh page with the English UI. `phone` emulates a touch phone that can share files. */
async function open({ width, height, phone = false, dark = false }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  await ctx.addInitScript(
    ({ dark, phone }) => {
      localStorage.setItem('flipreel:lang', 'en');
      localStorage.setItem('flipreel:theme', dark ? 'dark' : 'light');
      // Save to Downloads (no "Save as" window), like Safari and Firefox.
      window.showSaveFilePicker = undefined;
      if (phone) {
        navigator.canShare = () => true;
        navigator.share = async () => {};
      }
    },
    { dark, phone },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(APP);
  return page;
}

async function choose(page, selector, files) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator(selector).first().click();
  await (await chooser).setFiles(files);
}

async function addPhotos(page) {
  await choose(page, '[data-action="choose"]', PHOTOS);
  await page.waitForFunction((n) => {
    const imgs = [...document.querySelectorAll('.thumb img')];
    return imgs.length === n && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, PHOTOS.length);
}

async function goTo(page, step) {
  await page.evaluate((i) => document.querySelector(`[data-action="goto"][data-step="${i}"]`)?.click(), step);
  await page.waitForTimeout(300);
}

async function addSong(page) {
  await goTo(page, STEP.music);
  await choose(page, '[data-action="add-music"]', [SONG]);
  await page.waitForSelector('.music-file');
}

async function makeVideo(page) {
  await goTo(page, STEP.export);
  const download = page.waitForEvent('download', { timeout: 300_000 }).catch(() => null);
  await page.locator('[data-action="export"]').click();
  await page.waitForSelector('.result', { timeout: 300_000 });
  await download;
  await page.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete));
}

/** No hover or focus ring left over from the clicks. */
async function settle(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.waitForTimeout(300);
}

// ── Desktop ──
{
  const page = await open({ width: 1280, height: 960 });
  await addPhotos(page);
  await settle(page);
  await page.screenshot({ path: join(OUT, 'photos.png') });
  console.log('photos.png');

  await goTo(page, STEP.aspect);
  await page.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete));
  await settle(page);
  await page.screenshot({ path: join(OUT, 'aspect.png') });
  console.log('aspect.png');
  await page.context().close();
}
{
  const page = await open({ width: 1280, height: 1160 });
  await addPhotos(page);
  await addSong(page);
  await makeVideo(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await page.screenshot({ path: join(OUT, 'export.png') });
  console.log('export.png');
  await page.context().close();
}

// ── Phones: choosing photos (light) and the finished video (dark) ──
const phone = { width: 390, height: 844, phone: true };
let left;
let right;
{
  const page = await open(phone);
  await addPhotos(page);
  await settle(page);
  left = await page.screenshot();
  await page.context().close();
}
{
  const page = await open({ ...phone, dark: true });
  await addPhotos(page);
  await addSong(page);
  await makeVideo(page);
  await page.locator('.result').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.evaluate(() => window.scrollBy(0, 90));
  await settle(page);
  right = await page.screenshot();
  await page.context().close();
}
{
  const page = await browser.newPage({ viewport: { width: phone.width * 2, height: phone.height }, deviceScaleFactor: 2 });
  const src = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await page.setContent(`<style>body{margin:0;display:flex}img{width:${phone.width}px;height:${phone.height}px;display:block}</style>
    <img src="${src(left)}"><img src="${src(right)}">`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: join(OUT, 'phones.png') });
  console.log('phones.png');
  await page.close();
}

await browser.close();

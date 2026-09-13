const assert = require('node:assert/strict');
const path = require('node:path');
const { setup, save, artifacts } = require('./browser-tools.cjs');
const { ready, begin, snapshot } = require('./play-helpers.cjs');

async function hitTargets(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
    const r = node.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { label: node.textContent.trim(), width: r.width, height: r.height, within: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: node === top || node.contains(top) };
  }));
}

(async () => {
  const report = {};
  let env = await setup();
  try {
    await ready(env.page, env.url); await begin(env.page);
    const cells = await env.page.evaluate(() => window.__tender.sceneStats.cellCenters);
    const cell = cells.find(c => c.col === 4 && c.row === 1);
    await env.page.locator('[data-tool="pump"]:visible').click();
    await env.page.mouse.click(cell.x, cell.y);
    assert.ok((await snapshot(env.page)).run.structures.some(s => s.type === 'pump' && s.col === 4 && s.row === 1));
    await env.page.mouse.click(cell.x, cell.y, { button: 'right' });
    assert.equal((await snapshot(env.page)).run.structures.length, 6);
    await env.page.keyboard.press('Enter'); await env.page.keyboard.down('d'); await env.page.keyboard.down('s');
    await env.page.waitForFunction(() => window.__tender.run.status === 'lost', null, { timeout: 90000 });
    await env.page.keyboard.up('d'); await env.page.keyboard.up('s');
    report.defeat = (await snapshot(env.page)).run;
    await env.page.screenshot({ path: path.join(artifacts, 'defeat.png') });
    await env.page.keyboard.press('Enter');
    assert.equal((await snapshot(env.page)).run.status, 'prepare'); assert.equal((await snapshot(env.page)).run.time, 0);
    await env.page.keyboard.press('Escape');
    await env.page.locator('[data-action="back"]:visible').click();
    assert.equal((await snapshot(env.page)).screen, 'select');
    await env.page.keyboard.press('Escape');
    assert.equal((await snapshot(env.page)).screen, 'title');
    assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []);
    report.mouseAndRetry = true;
  } finally { await env.close(); }

  report.mobile = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    env = await setup({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    try {
      const page = env.page; await ready(page, env.url);
      await page.locator('[data-action="start"]:visible').tap();
      await page.locator('[data-action="begin"]:visible').tap();
      assert.equal((await snapshot(page)).screen, 'play');
      await page.screenshot({ path: path.join(artifacts, `touch-build-${viewport.width}.png`) });
      const targets = await hitTargets(page, '#play-screen button');
      for (const t of targets) { assert.ok(t.width >= 44 && t.height >= 44 && t.within && t.hit, JSON.stringify({ viewport, t })); }
      const before = (await snapshot(page)).cursor;
      await page.locator('[data-touch="right"]').tap();
      assert.equal((await snapshot(page)).cursor.col, before.col + 1, 'short touch moves one cell immediately');
      await page.locator('[data-tool="pump"]').tap(); await page.locator('[data-action="place"]:visible').tap();
      assert.equal((await snapshot(page)).run.structures.length, 7);
      await page.locator('[data-action="remove"]:visible').tap();
      assert.equal((await snapshot(page)).run.structures.length, 6);
      await page.locator('[data-action="launch"]:visible').tap();
      const a = await page.locator('[data-touch="right"]').boundingBox(), b = await page.locator('[data-touch="down"]').boundingBox();
      const cdp = await env.context.newCDPSession(page), points = [a, b].map((r, id) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2, id, radiusX: 6, radiusY: 6 }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
      await page.waitForTimeout(300);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const moved = (await snapshot(page)).run.tank; assert.ok(moved.x > .3 && moved.z > .3);
      await page.waitForTimeout(150);
      assert.deepEqual((await snapshot(page)).run.tank, moved, 'released multi-touch does not stick');
      await page.screenshot({ path: path.join(artifacts, `touch-storm-${viewport.width}.png`) });
      assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []);
      report.mobile.push({ viewport, targets, tank: moved, scene: await page.evaluate(() => window.__tender.sceneStats) });
    } finally { await env.close(); }
  }

  env = await setup();
  try {
    await env.page.addInitScript(() => {
      localStorage.setItem('tenderweight-records-v1', JSON.stringify({ standard: { 'first-rescue': { grade: 'S', peakWater: null, peakTilt: 0, stormTime: 75, rescued: 10 } } }));
      localStorage.setItem('tenderweight-settings-v1', JSON.stringify({ volume: 0, muted: false, mode: 'gentle' }));
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await ready(env.page, env.url); await begin(env.page);
    assert.deepEqual(await env.page.evaluate(() => window.__tender.records.standard), {});
    assert.equal(await env.page.evaluate(() => window.__tender.settings.volume), 0);
    assert.equal((await snapshot(env.page)).run.mode, 'gentle');
    await env.page.keyboard.press('Enter'); await env.page.waitForTimeout(100);
    assert.equal((await snapshot(env.page)).run.status, 'storm'); assert.deepEqual(env.errors, []);
    report.storageAndAudioFallback = true;
  } finally { await env.close(); }

  env = await setup();
  try {
    // Isolated saved-record fixture unlocks a voyage to check its preflight UI; not campaign evidence.
    await env.page.addInitScript(() => localStorage.setItem('tenderweight-records-v1', JSON.stringify({ standard: { 'first-rescue': { grade: 'S', peakWater: 0, peakTilt: .1, stormTime: 75, rescued: 10 } }, gentle: {} })));
    await ready(env.page, env.url); await begin(env.page);
    assert.equal((await snapshot(env.page)).run.voyageId, 'cross-current');
    await env.page.keyboard.press('Enter');
    assert.equal((await snapshot(env.page)).run.status, 'prepare');
    assert.match(await env.page.locator('#event-text').textContent(), /부족|필요/, 'blocked launch explains insufficient shelter');
    await env.page.keyboard.press('2'); await env.page.keyboard.press('Space');
    assert.ok(await env.page.locator('[data-action="launch"]:visible').isEnabled());
    await env.page.keyboard.press('Enter');
    assert.equal((await snapshot(env.page)).run.status, 'storm');
    assert.deepEqual(env.errors, []); report.capacityPreflight = true;
  } finally { await env.close(); }

  env = await setup();
  try {
    await env.page.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/i.test(type) ? null : get.call(this, type, ...args); }; });
    await ready(env.page, env.url);
    const banner = await env.page.locator('#error-banner').evaluate(node => { const r = node.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { text: node.textContent, height: r.height, hit: top === node || node.contains(top) }; });
    assert.ok(banner.height > 20 && banner.hit && banner.text.length > 10);
    await env.page.screenshot({ path: path.join(artifacts, 'webgl-fallback.png') });
    assert.deepEqual(env.errors, []); report.webglFallback = banner;
  } finally { await env.close(); }
  save('interaction-report.json', report); console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });

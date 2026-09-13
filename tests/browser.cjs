const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setup, audioEvidence, save, root, artifacts } = require('./browser-tools.cjs');
const { ready, begin, snapshot, place } = require('./play-helpers.cjs');

(async () => {
  const report = [];
  for (const kind of ['file', 'subpath']) {
    const env = await setup(), { page } = env;
    try {
      await ready(page, kind === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : env.url);
      await page.screenshot({ path: path.join(artifacts, `${kind}-title.png`) });
      await begin(page);
      const initial = await snapshot(page);
      assert.equal(initial.run.structures.length, 6);
      await page.evaluate(() => { const a = window.__tender.run; a.budget = -100; a.structures.length = 0; const b = window.__tender.settings; b.volume = -10; });
      assert.equal((await snapshot(page)).run.budget, initial.run.budget);
      assert.equal((await snapshot(page)).run.structures.length, 6);
      await place(page, 'pump', 2, 2);
      await page.keyboard.press('Backspace');
      assert.equal((await snapshot(page)).run.budget, initial.run.budget);
      await page.keyboard.press('Backspace');
      assert.equal((await snapshot(page)).run.budget, initial.run.budget);
      await place(page, 'pump', 2, 2);
      await page.screenshot({ path: path.join(artifacts, `${kind}-build.png`) });
      await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__tender.run.status === 'storm');
      await page.keyboard.down('d'); await page.waitForTimeout(220); await page.keyboard.up('d');
      assert.ok((await snapshot(page)).run.tank.x > .2);
      await page.waitForTimeout(1200);
      const sound = await audioEvidence(page); assert.ok(sound.peak > .00001 && sound.peak < 1, 'audible unclipped procedural sound');
      await page.keyboard.press('Escape');
      const paused = (await snapshot(page)).run;
      await page.waitForTimeout(300); assert.equal((await snapshot(page)).run.time, paused.time);
      assert.ok((await audioEvidence(page)).states.every(state => state === 'suspended'));
      await page.locator('[data-action="guide"]:visible').click();
      assert.equal((await snapshot(page)).screen, 'guide');
      await page.waitForTimeout(150);
      assert.ok((await audioEvidence(page)).states.every(state => state === 'suspended'), 'pause guide preserves suspended audio');
      assert.equal((await snapshot(page)).run.time, paused.time);
      await page.locator('[data-action="back"]:visible').click();
      assert.equal((await snapshot(page)).screen, 'pause');
      await page.waitForTimeout(100);
      assert.ok((await audioEvidence(page)).states.every(state => state === 'suspended'));
      await page.locator('[data-action="resume"]:visible').click();
      await page.waitForTimeout(200); assert.ok((await snapshot(page)).run.time > paused.time);
      await page.keyboard.press('m');
      await page.waitForTimeout(200);
      await page.evaluate(() => { window.__audioEvidence.peak = 0; window.__audioEvidence.energy = 0; window.__audioEvidence.samples = 0; });
      await page.waitForTimeout(200); assert.ok((await audioEvidence(page)).peak < .00001, 'mute is silent');
      await page.screenshot({ path: path.join(artifacts, `${kind}-storm.png`) });
      assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []); assert.deepEqual(env.consoleErrors, []);
      report.push({ kind, scene: await page.evaluate(() => window.__tender.sceneStats), audio: sound, mutedAudio: await audioEvidence(page), requests: env.requests, errors: env.errors, failed: env.failed });
    } finally { await env.close(); }
  }
  save('browser-report.json', report); console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });

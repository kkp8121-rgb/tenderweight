const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { setup, audioEvidence, save, artifacts, root } = require('./browser-tools.cjs');
const { ready, begin, snapshot, place, buildFor, setKeys } = require('./play-helpers.cjs');

(async () => {
  const { metrics } = await import('../src/game.js');
  const { VOYAGES, TUNING } = await import('../src/voyages.js');
  const hardware = process.argv.includes('--hardware');
  const bundleSHA256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'game.js'))).digest('hex');
  const env = await setup({}, hardware ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] } : {});
  const { page } = env, held = new Set(), voyages = [];
  try {
    await ready(page, env.url); await begin(page);
    for (const voyage of VOYAGES) {
      let state = await snapshot(page);
      assert.equal(state.run.voyageId, voyage.id);
      for (const build of buildFor(voyage.id)) await place(page, ...build);
      await page.screenshot({ path: path.join(artifacts, `campaign-${voyage.id}-build.png`) });
      const transitions = [], deadline = Date.now() + 300000;
      while (Date.now() < deadline) {
        state = await snapshot(page);
        if (['won', 'lost'].includes(state.run.status)) break;
        if (state.screen === 'clear') { await setKeys(page, held, []); await page.keyboard.press('Enter'); continue; }
        if (state.run.status === 'prepare') {
          await setKeys(page, held, []);
          if (state.run.stageIndex > 0 && !state.run.structures.some(s => s.type === 'pump' && s.col === 3 && s.row === 3)) await place(page, 'pump', 3, 3);
          transitions.push(state.run.stageIndex);
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => window.__tender.run.status === 'storm');
          continue;
        }
        assert.equal(state.screen, 'play');
        const r = state.run, m = metrics(r), clamp = value => Math.max(-TUNING.tankRange, Math.min(TUNING.tankRange, value));
        const x = clamp(-(m.momentX - TUNING.tankMass * r.tank.x + r.wind.x) / TUNING.tankMass - 2 * r.roll - .8 * r.rollVelocity);
        const z = clamp(-(m.momentZ - TUNING.tankMass * r.tank.z + r.wind.z) / TUNING.tankMass - 2 * r.pitch - .8 * r.pitchVelocity);
        const wanted = [];
        if (Math.abs(x - r.tank.x) > .11) wanted.push(x > r.tank.x ? 'd' : 'a');
        if (Math.abs(z - r.tank.z) > .11) wanted.push(z > r.tank.z ? 's' : 'w');
        await setKeys(page, held, wanted); await page.waitForTimeout(35);
      }
      await setKeys(page, held, []); state = await snapshot(page);
      assert.equal(state.run.status, 'won', JSON.stringify(state));
      assert.equal(state.run.rescued, voyage.total);
      assert.deepEqual(transitions, voyage.stages.map((_, i) => i));
      voyages.push({ id: voyage.id, rescued: state.run.rescued, ...state.run.stats, transitions });
      console.log(JSON.stringify(voyages.at(-1)));
      await page.screenshot({ path: path.join(artifacts, `campaign-${voyage.id}-complete.png`) });
      if (voyage !== VOYAGES.at(-1)) {
        await page.keyboard.press('Enter');
        await page.waitForFunction(id => window.__tender.screen === 'play' && window.__tender.run?.voyageId !== id, voyage.id);
      }
    }
    assert.equal((await snapshot(page)).screen, 'ending');
    const before = await page.evaluate(() => window.__tender.records);
    assert.equal(Object.keys(before.standard).length, 3);
    const audio = await audioEvidence(page), scene = await page.evaluate(() => window.__tender.sceneStats);
    await page.reload(); await page.waitForFunction(() => window.__tender?.ready);
    assert.deepEqual(await page.evaluate(() => window.__tender.records), before);
    assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []); assert.deepEqual(env.consoleErrors, []);
    if (hardware) assert.equal(scene.software, false);
    save(`campaign${hardware ? '-hardware' : ''}.json`, { bundleSHA256, realInputs: true, liveStateMutations: 0, voyages, records: before, audio, scene, errors: env.errors, failed: env.failed });
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'campaign-failure.png') }).catch(() => {});
    save('campaign-failure.json', { message: error.message, state: await snapshot(page).catch(() => null), errors: env.errors });
    throw error;
  } finally { await env.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

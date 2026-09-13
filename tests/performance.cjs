const assert = require('node:assert/strict');
const path = require('node:path');
const { setup, audioEvidence, save, artifacts } = require('./browser-tools.cjs');
const { ready, begin } = require('./play-helpers.cjs');

(async () => {
  const hardware = process.argv.includes('--hardware'), report = [];
  for (const rate of hardware ? [1] : [1, 4]) {
    const env = await setup({}, hardware ? { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] } : {});
    try {
      await ready(env.page, env.url); await begin(env.page);
      const cdp = await env.context.newCDPSession(env.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await env.page.keyboard.press('Enter'); await env.page.waitForTimeout(2000);
      await env.page.evaluate(() => { window.__audioEvidence.frames.length = 0; });
      await env.page.waitForTimeout(6000);
      const stats = await env.page.evaluate(() => window.__tender.sceneStats);
      const renderer = await env.page.evaluate(() => { const gl = document.querySelector('#world canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
      if (hardware) assert.equal(stats.software, false); else assert.equal(stats.software, true);
      assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []);
      await env.page.screenshot({ path: path.join(artifacts, `performance-${hardware ? 'hardware' : 'software'}-${rate}.png`) });
      report.push({ hardware, rate, renderer, stats, audio: await audioEvidence(env.page) });
      console.log(JSON.stringify(report.at(-1)));
    } finally { await env.close(); }
  }
  save(hardware ? 'hardware-report.json' : 'performance-report.json', report);
})().catch(error => { console.error(error); process.exitCode = 1; });

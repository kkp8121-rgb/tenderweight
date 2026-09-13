const assert = require('node:assert/strict');

const snapshot = page => page.evaluate(() => ({ screen: window.__tender.screen, run: window.__tender.run, cursor: window.__tender.cursor }));
async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__tender?.ready);
}
async function begin(page) {
  await page.keyboard.press('Enter');
  if ((await snapshot(page)).screen === 'select') await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__tender.screen === 'play' && window.__tender.run?.status === 'prepare');
}
async function place(page, type, col, row) {
  const keys = { pontoon: '1', cabin: '2', pump: '3' };
  await page.keyboard.press(keys[type]);
  let current = (await snapshot(page)).cursor;
  for (let i = 0; i < Math.abs(col - current.col); i++) await page.keyboard.press(col > current.col ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(row - current.row); i++) await page.keyboard.press(row > current.row ? 'ArrowDown' : 'ArrowUp');
  await page.keyboard.press('Space');
  const state = await snapshot(page);
  assert.ok(state.run.structures.some(s => s.type === type && s.col === col && s.row === row), `placed ${type} ${col},${row}`);
}
function buildFor(id) {
  if (id === 'first-rescue') return [['pump', 2, 2], ['pontoon', 1, 0], ['pontoon', 4, 5]];
  return [['cabin', 2, 1], ['cabin', 3, 4], ['pontoon', 1, 0], ['pontoon', 4, 5], ['pontoon', 0, 4], ['pontoon', 5, 1], ['pump', 2, 2], ...(id === 'last-harbor' ? [['pump', 3, 3], ['pontoon', 2, 0], ['pontoon', 3, 5]] : [])];
}
async function setKeys(page, held, wanted) {
  for (const key of [...held]) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key); }
  for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
}
module.exports = { snapshot, ready, begin, place, buildFor, setKeys };

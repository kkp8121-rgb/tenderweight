import { VOYAGES, getVoyage, BUILDINGS, TUNING } from './voyages.js';
import { createRun, placeBuilding, removeBuilding, launchStage, stepRun, summarize, preflight, metrics } from './game.js';
import { createScene } from './scene.js';
import { createAudio } from './audio.js';

const RECORDS_KEY = 'tenderweight-records-v1', SETTINGS_KEY = 'tenderweight-settings-v1', FIXED = 1 / 60;
const clone = (value, fallback = null) => { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; } };
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function boot() {
  const app = document.getElementById('app'), world = document.getElementById('world'), canvas = document.getElementById('world-canvas');
  let scene = null, sceneError = false, run = null, screen = 'title', previousScreen = 'title', guideReturn = 'title';
  let selectedVoyage = VOYAGES?.[0]?.id || null, selectedTool = 'pontoon', cursor = { col: 2, row: 2 }, lossReason = '';
  let settings = loadSettings(), records = loadRecords(), accumulator = 0, lastFrame = performance.now(), cursorClock = 0;
  let eventQueue = [], lastMessage = '', lastMessageUntil = 0;
  const held = { left: new Set(), right: new Set(), up: new Set(), down: new Set(), fine: new Set() };

  try { scene = createScene(world); } catch (error) { sceneError = true; const fallback = document.getElementById('scene-fallback'); if (fallback) fallback.classList.add('hidden'); const banner = document.getElementById('error-banner'); if (banner) { banner.textContent = '\u0033D \uC7A5\uBA74\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uADF8\uB798\uD53D \uAC00\uC18D\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.'; banner.classList.remove('hidden'); } console.error(error); }
  let audio = {};
  try { audio = createAudio?.() || {}; audio.setVolume?.(settings.volume); audio.setMuted?.(settings.muted); } catch (error) { console.error(error); }

  function loadSettings() { try { const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { volume: Number.isFinite(raw?.volume) ? Math.max(0, Math.min(1, raw.volume)) : .24, muted: raw?.muted === true, mode: raw?.mode === 'gentle' ? 'gentle' : 'standard' }; } catch (_) { return { volume: .24, muted: false, mode: 'standard' }; } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {} }
  function loadRecords() {
    const clean = { standard: {}, gentle: {} };
    try {
      const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
      for (const mode of ['standard', 'gentle']) for (const voyage of VOYAGES || []) {
        const record = raw?.[mode]?.[voyage.id];
        const valid = record && ['S', 'A', 'B'].includes(record.grade) && Number.isFinite(record.peakWater) && record.peakWater >= 0 && Number.isFinite(record.peakTilt) && record.peakTilt >= 0 && Number.isFinite(record.stormTime) && record.stormTime >= 0 && Number.isInteger(record.rescued) && record.rescued >= 0 && record.rescued <= voyage.total;
        if (valid) clean[mode][voyage.id] = { grade: record.grade, peakWater: record.peakWater, peakTilt: record.peakTilt, stormTime: record.stormTime, rescued: record.rescued };
      }
    } catch (_) {}
    return clean;
  }
  function saveRecords() { try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (_) {} }
  function unlocked(index) { return index === 0 || !!records.standard?.[VOYAGES[index - 1]?.id] || !!records.gentle?.[VOYAGES[index - 1]?.id]; }
  function currentVoyage() { return getVoyage(run?.voyageId || selectedVoyage) || VOYAGES?.[0] || null; }
  function clearInputs() { Object.values(held).forEach((sources) => sources.clear()); cursorClock = 0; accumulator = 0; eventQueue.length = 0; lastMessage = ''; lastMessageUntil = 0; document.querySelectorAll('[data-touch]').forEach((node) => node.classList.remove('held')); }
  function setHeld(action, source, value) { if (held[action]) value ? held[action].add(source) : held[action].delete(source); }
  function showMessage(text) { if (text) { lastMessage = String(text); lastMessageUntil = performance.now() + 3000; } }
  function playSound(name) { try { const result = audio.play?.(name); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function unlockAudio() { try { const result = audio.unlock?.(); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function show(next) { clearInputs(); if (next === 'play' || next === 'pause') { accumulator = 0; lastFrame = performance.now(); } screen = next; app.dataset.screen = next; document.querySelectorAll('[data-screen]').forEach((node) => node.classList.toggle('hidden', node.dataset.screen !== next)); render(); scene?.resize?.(); }
  function moveCursor(dx, dz) { const size = Math.max(1, Math.floor(finite(TUNING?.size, 6))); cursor.col = Math.max(0, Math.min(size - 1, cursor.col + dx)); cursor.row = Math.max(0, Math.min(size - 1, cursor.row + dz)); renderPlay(); }
  function selectedDefinition() { return BUILDINGS?.[selectedTool] || null; }
  function cursorState() { const definition = selectedDefinition(), size = Math.max(1, Math.floor(finite(TUNING?.size, 6))), inside = cursor.col >= 0 && cursor.col < size && cursor.row >= 0 && cursor.row < size, occupied = run?.structures?.some((building) => building.col === cursor.col && building.row === cursor.row), affordable = (run?.budget || 0) >= (definition?.cost || Infinity), reason = !inside ? 'outside' : occupied ? 'occupied' : !affordable ? 'budget' : null; return { col: cursor.col, row: cursor.row, type: selectedTool, valid: !reason, reason }; }
  function placementMessage(state) { return state?.reason === 'outside' ? '갑판 밖에는 건설할 수 없습니다.' : state?.reason === 'occupied' ? '그 칸은 이미 사용 중입니다.' : state?.reason === 'budget' ? '목재가 부족합니다.' : ''; }
  function sideLabel(side) { return ({ west: '서쪽', east: '동쪽', north: '북쪽', south: '남쪽' })[side] || side || '바깥쪽'; }
  function windVectorLabel(force = {}) { const parts = []; const x = finite(force.x), z = finite(force.z); if (Math.abs(x) > .1) parts.push((x > 0 ? '\uC624\uB978\uCABD \u2192' : '\uC67C\uCABD \u2190') + ' ' + Math.abs(x).toFixed(0)); if (Math.abs(z) > .1) parts.push((z > 0 ? '\uB4A4\uCABD \u2193' : '\uC55E\uCABD \u2191') + ' ' + Math.abs(z).toFixed(0)); return parts.join(', ') || '\uC57D\uD55C \uBC14\uB78C'; }
  function preview() { try { return createRun(selectedVoyage, settings.mode); } catch (_) { return null; } }
  function renderTitle() { const button = document.getElementById('continue-button'), start = document.querySelector('[data-action="start"]'), has = Object.values(records).some((mode) => Object.keys(mode).length); if (button) { button.disabled = !has || sceneError; button.textContent = has ? '기록 이어하기' : '기록 없음'; } if (start) start.disabled = sceneError; }
  function renderSelect() { const list = document.getElementById('voyage-list'); if (!list) return; list.innerHTML = ''; (VOYAGES || []).forEach((voyage, index) => { const open = unlocked(index), record = records[settings.mode]?.[voyage.id], button = document.createElement('button'); button.className = `voyage-option ${selectedVoyage === voyage.id ? 'selected' : ''} ${open ? '' : 'locked'}`; button.dataset.voyageId = voyage.id; button.disabled = !open || sceneError; const title = document.createElement('b'), intro = document.createElement('small'), stat = document.createElement('span'); title.textContent = `${index + 1}. ${voyage.title}`; intro.textContent = voyage.intro || '새로운 부유 마을을 준비합니다.'; stat.className = 'voyage-record'; stat.textContent = record ? `${record.grade} · 물 ${(record.peakWater * 100).toFixed(0)}%` : open ? '새 항해' : '잠김'; button.append(title, intro, stat); list.appendChild(button); }); const candidate = preview(), plan = candidate ? preflight(candidate) : null, summary = document.getElementById('preflight-summary'); if (summary) summary.textContent = plan ? `${plan.ok ? '출항 가능' : plan.reason} · 쉼터 ${plan.capacity || 0} / 필요 ${plan.required || 0}` : ''; const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; const begin = document.querySelector('[data-action="begin"]'); if (begin) begin.disabled = sceneError; }
  function renderPlay() {
    if (!run) return;
    app.dataset.phase = run.status;
    const voyage = currentVoyage(), stat = metrics(run) || {}, storm = run.status === 'storm', phase = document.getElementById('voyage-phase');
    const capsize = Math.max(.01, finite(TUNING?.capsizeAngle, .55));
    document.getElementById('voyage-title').textContent = voyage?.title || run.voyageId;
    document.getElementById('voyage-mode').textContent = run.mode === 'gentle' ? '\uBD80\uB4DC\uB7FD\uAC8C \uD56D\uD574' : '\uD45C\uC900 \uD56D\uD574';
    if (phase) phase.textContent = storm ? '\uD3ED\uD48D ' + ((run.stageIndex || 0) + 1) : run.stageIndex ? '\uC218\uB9AC / \uC900\uBE44' : '\uAC74\uC124 / \uC900\uBE44';
    document.getElementById('rescued-value').textContent = (run.rescued || 0) + ' / ' + (voyage?.total || 0);
    document.getElementById('budget-value').textContent = (run.budget || 0) + ' \uBAA9\uC7AC';
    const water = Math.max(0, Math.min(1, run.water || 0)), tilt = Math.max(Math.abs(run.roll || 0), Math.abs(run.pitch || 0));
    document.getElementById('water-value').textContent = Math.round(water * 100) + '%';
    document.getElementById('water-meter').style.width = water * 100 + '%';
    document.getElementById('tilt-value').textContent = (tilt * 180 / Math.PI).toFixed(1) + '°';
    document.getElementById('tilt-meter').style.width = Math.min(100, tilt / capsize * 100) + '%';
    document.getElementById('prepare-panel').classList.toggle('hidden', storm);
    document.getElementById('storm-panel').classList.toggle('hidden', !storm);
    if (storm) {
      const stage = voyage?.stages?.[run.stageIndex], force = run.wind || stage?.force || { x: 0, z: 0 };
      document.getElementById('storm-stage').textContent = '\uD3ED\uD48D ' + ((run.stageIndex || 0) + 1) + ' - ' + sideLabel(stage?.side);
      document.getElementById('storm-time').textContent = Math.ceil(Math.max(0, stage.duration - run.stageTime)) + '초 남음';
      document.getElementById('wind-value').textContent = '\uBC14\uB78C - ' + windVectorLabel(force);
      const high = [];
      if (Math.abs(run.roll) > .025) high.push(run.roll > 0 ? '왼쪽 ←' : '오른쪽 →');
      if (Math.abs(run.pitch) > .025) high.push(run.pitch > 0 ? '위쪽 ↑' : '아래쪽 ↓');
      document.getElementById('storm-copy').textContent = high.length ? '높이 뜬 쪽: ' + high.join(' · ') + '. 평형추를 조금씩 옮기세요.' : '균형이 안정적입니다. 새 주민이 올라올 때 기울기를 살피세요.';
      document.getElementById('tank-value').textContent = '평형추 · ' + (held.fine.size ? '정밀 이동' : '기본 이동');
    } else {
      const tool = selectedDefinition(), state = cursorState(), next = voyage?.stages?.[run.stageIndex], force = next?.force || { x: 0, z: 0 };
      document.getElementById('cursor-label').textContent = '\uAC74\uC124 \uCEE4\uC11C ' + (cursor.col + 1) + ', ' + (cursor.row + 1);
      document.getElementById('capacity-value').textContent = '\uB300\uD53C \uACF5\uAC04 ' + (stat.capacity || 0) + ' / ' + (voyage?.total || 0);
      document.getElementById('prepare-copy').textContent = next ? '다음 구조: ' + sideLabel(next.side) + '에서 ' + next.count + '명. 바람 ' + windVectorLabel(force) + '. 높이 뜬 쪽으로 평형추를 옮기세요.' : '주민 전원을 맞을 쉼터를 지으세요.';
      for (const type of ['pontoon', 'cabin', 'pump']) { const cost = document.getElementById('tool-' + type + '-cost'), definition = BUILDINGS[type]; const effect = type === 'pontoon' ? '부력 +' + definition.lift : type === 'cabin' ? definition.capacity + '명 수용' : '물 빼기'; if (cost) cost.textContent = definition.cost + ' 목재 · ' + effect; }
      document.getElementById('cursor-status').textContent = (tool?.name || selectedTool) + ' - ' + (tool?.cost || 0) + ' \uBAA9\uC7AC - ' + (state.valid ? '\uBC30\uCE58 \uAC00\uB2A5' : placementMessage(state));
      document.querySelectorAll('[data-tool]').forEach((node) => node.classList.toggle('selected', node.dataset.tool === selectedTool));
    }
    const objectiveNode = document.getElementById('objective-text'); objectiveNode.textContent = storm ? '높이 뜬 쪽으로 평형추를 옮겨 균형을 지키세요.' : ''; objectiveNode.classList.toggle('hidden', !storm);
    const eventNode = document.getElementById('event-text'); const message = lastMessage && performance.now() < lastMessageUntil ? lastMessage : ''; eventNode.textContent = message; eventNode.classList.toggle('hidden', !message);
  }
  function renderClear() {
    const voyage = currentVoyage(), summary = summarize(run) || {}, completed = run?.status === 'won';
    document.getElementById('clear-title').textContent = completed ? (voyage?.title || '') + ' \uC644\uB8CC' : (voyage?.title || '') + ' - \uB2E4\uC74C \uD3ED\uD48D \uC804';
    const next = voyage?.stages?.[run?.stageIndex];
    document.getElementById('clear-copy').textContent = completed ? '\uD56D\uD574\uB97C \uC644\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB4F0\uB85C \uB2E4\uC74C \uD56D\uD574\uB97C \uC120\uD0DD\uD558\uC138\uC694. \uB4F1\uAE09 ' + (summary.grade || '-') + '.' : '\uD3ED\uD48D\uC744 \uB118\uAE30\uACE0 \uC8FC\uBBFC\uB4E4\uC774 \uB3CC\uC544\uC654\uC2B5\uB2C8\uB2E4. ' + (next ? sideLabel(next.side) + ' \uBC29\uD5A5\uC5D0\uC11C \uC8FC\uBBFC ' + next.count + '\uBA85\uC774 \uB3C4\uCC29\uD569\uB2C8\uB2E4.' : '') + ' \uBC30\uB97C \uC218\uB9AC\uD558\uACE0 \uB2E4\uC74C \uD3ED\uD48D\uC744 \uC900\uBE44\uD558\uC138\uC694.';
    document.getElementById('clear-stats').innerHTML = '<span><small>\uAD6C\uC870</small><b>' + (summary.rescued || 0) + ' / ' + (summary.total || 0) + '</b></span><span><small>\uCD5C\uACE0 \uBB3C</small><b>' + ((summary.peakWater || 0) * 100).toFixed(0) + '%</b></span><span><small>\uCD5C\uACE0 \uAE30\uC6B8\uAE30</small><b>' + ((summary.peakTilt || 0) * 57.3).toFixed(1) + '\u00B0</b></span>';
  }  function renderDefeat() { const reason = lossReason || run?._lossReason || run?.lossReason || '배의 균형이 무너졌습니다.'; document.getElementById('defeat-copy').textContent = `${reason} 물 ${(finite(run?.water) * 100).toFixed(0)}%, 최고 기울기 ${(finite(run?.stats?.peakTilt) * 57.3).toFixed(1)}°. 준비 단계부터 다시 시작합니다.`; }
  function renderEnding() { const summary = summarize(run) || {}; document.getElementById('ending-stats').innerHTML = `<span><small>구조한 주민</small><b>${summary.rescued || 0} / ${summary.total || 0}</b></span><span><small>최고 물</small><b>${((summary.peakWater || 0) * 100).toFixed(0)}%</b></span><span><small>폭풍 시간</small><b>${finite(summary.stormTime).toFixed(1)}s</b></span>`; }
  function render() { if (screen === 'title') renderTitle(); else if (screen === 'select') renderSelect(); else if (screen === 'play') renderPlay(); else if (screen === 'clear') renderClear(); else if (screen === 'defeat') renderDefeat(); else if (screen === 'ending') renderEnding(); const mute = document.getElementById('mute-button'); if (mute) mute.textContent = settings.muted ? '음소거 해제' : '음소거'; const volume = document.getElementById('volume-range'); if (volume) volume.value = settings.volume; const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; }
  function handleEvents(events) { for (const event of events || []) { if (event.type === 'lose') lossReason = event.reason || event.text || lossReason; if (event.text) showMessage(event.text); const sound = event.type === 'placed' ? 'place' : event.type === 'removed' ? 'remove' : event.type === 'denied' ? 'error' : event.type === 'arrival' ? 'arrival' : event.type === 'stage-clear' ? 'stage-clear' : null; if (sound) playSound(sound); } }
  function actionEvents(events) { const list = events || []; eventQueue.push(...list); return list; }
  function placeCurrent() { if (!run || run.status !== 'prepare') return; const state = cursorState(); if (!state.valid) { showMessage(placementMessage(state)); playSound('error'); renderPlay(); return; } try { actionEvents(placeBuilding(run, selectedTool, cursor.col, cursor.row)); } catch (error) { console.error(error); } renderPlay(); }
  function removeCurrent() { if (!run || run.status !== 'prepare') return; try { actionEvents(removeBuilding(run, cursor.col, cursor.row)); } catch (error) { console.error(error); } renderPlay(); }
  function launch() { if (!run || run.status !== 'prepare') return; const plan = preflight(run); if (!plan?.ok) { showMessage(plan?.reason || '출항 조건을 확인하세요.'); playSound('error'); renderPlay(); return; } clearInputs(); try { actionEvents(launchStage(run)); } catch (error) { console.error(error); } renderPlay(); }
  function startRun() { if (sceneError) return; const voyage = getVoyage(selectedVoyage); if (!voyage) return; try { lossReason = ''; run = createRun(voyage.id, settings.mode); cursor = { col: 2, row: 2 }; scene?.setVoyage?.(voyage); audio.stop?.(); audio.start?.(); unlockAudio(); playSound('select'); show('play'); } catch (error) { console.error(error); run = null; } }
  function continueRun() { const index = (VOYAGES || []).findIndex((voyage, position) => unlocked(position) && !records.standard?.[voyage.id] && !records.gentle?.[voyage.id]); selectedVoyage = VOYAGES?.[index >= 0 ? index : Math.max(0, (VOYAGES || []).length - 1)]?.id || selectedVoyage; show('select'); }
  function nextStage() { if (!run) return; if (run.status === 'won') { const index = VOYAGES.findIndex((voyage) => voyage.id === run.voyageId); selectedVoyage = VOYAGES[index + 1]?.id || selectedVoyage; run = null; startRun(); } else show('play'); }
  function finish() { if (!run) return; const summary = summarize(run) || {}; if (run.status === 'won') { records[run.mode] ||= {}; const old = records[run.mode][run.voyageId]; const better = !old || summary.peakWater < old.peakWater || summary.peakWater === old.peakWater && summary.stormTime < old.stormTime; if (better) { records[run.mode][run.voyageId] = { grade: summary.grade, peakWater: summary.peakWater, peakTilt: summary.peakTilt, stormTime: summary.stormTime, rescued: summary.rescued }; saveRecords(); } const index = VOYAGES.findIndex((voyage) => voyage.id === run.voyageId); if (index === VOYAGES.length - 1) { renderEnding(); show('ending'); } else { renderClear(); show('clear'); } playSound('win'); } else { renderDefeat(); show('defeat'); playSound('lose'); } }
  function frame(now) {
    const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (screen === 'play' && run) {
      const frameEvents = eventQueue.splice(0);
      if (run.status === 'prepare') {
        const dx = (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0), dz = (held.down.size ? 1 : 0) - (held.up.size ? 1 : 0);
        if (dx || dz) { cursorClock += elapsed; if (cursorClock >= .14) { cursorClock = 0; moveCursor(dx, dz); } } else cursorClock = 0;
      } else if (run.status === 'storm') {
        accumulator += elapsed;
        let steps = 0;
        const input = { x: (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0), z: (held.down.size ? 1 : 0) - (held.up.size ? 1 : 0), fine: held.fine.size > 0 };
        while (accumulator >= FIXED && steps++ < 8) { const events = stepRun(run, input, FIXED) || []; frameEvents.push(...events); accumulator -= FIXED; }
      }
      run.events = frameEvents;
      handleEvents(frameEvents);
      try { scene?.update?.(run, elapsed, run.status === 'prepare' ? cursorState() : null); } catch (error) { console.error(error); }
      try { audio.update?.(run, elapsed); } catch (_) {}
      if (frameEvents.some((event) => event.type === 'stage-clear') && run.status === 'prepare') { renderClear(); show('clear'); }
      else if (run.status === 'won' || run.status === 'lost') finish();
      else renderPlay();
    }
    requestAnimationFrame(frame);
  }
  function keydown(event) { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return; const key = event.key.toLowerCase(); if (key === 'm' && !event.repeat) { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); return; } if (key === 'escape' && !event.repeat) { if (screen === 'play') { previousScreen = 'play'; audio.pause?.(); show('pause'); } else if (screen === 'pause') { audio.resume?.(); show('play'); } else if (screen === 'guide') show(guideReturn); else if (screen === 'select') show('title'); event.preventDefault(); return; } if (screen === 'title' && key === 'enter' && !event.repeat) { continueRun(); event.preventDefault(); return; } if (screen === 'select' && key === 'enter' && !event.repeat) { startRun(); event.preventDefault(); return; } if (screen === 'clear' && key === 'enter' && !event.repeat) { nextStage(); event.preventDefault(); return; } if (screen === 'defeat' && (key === 'r' || key === 'enter') && !event.repeat) { selectedVoyage = run?.voyageId || selectedVoyage; startRun(); event.preventDefault(); return; } if (screen === 'ending' && key === 'enter' && !event.repeat) { run = null; show('select'); event.preventDefault(); return; } if (screen !== 'play') return; if ((key === '1' || key === '2' || key === '3') && !event.repeat) { selectedTool = ['pontoon', 'cabin', 'pump'][Number(key) - 1]; renderPlay(); event.preventDefault(); return; } if ((key === ' ' || key === 'spacebar') && !event.repeat) { if (run.status === 'prepare') placeCurrent(); event.preventDefault(); return; } if (key === 'backspace' && !event.repeat) { removeCurrent(); event.preventDefault(); return; } if (key === 'enter' && !event.repeat) { launch(); event.preventDefault(); return; } const action = key === 'a' || key === 'arrowleft' ? 'left' : key === 'd' || key === 'arrowright' ? 'right' : key === 'w' || key === 'arrowup' ? 'up' : key === 's' || key === 'arrowdown' ? 'down' : key === 'shift' ? 'fine' : null; if (action) { if (run?.status === 'prepare' && !held[action].size) cursorClock = 0; setHeld(action, `key:${key}`, true); if (run.status === 'prepare' && !event.repeat) moveCursor(action === 'right' ? 1 : action === 'left' ? -1 : 0, action === 'down' ? 1 : action === 'up' ? -1 : 0); event.preventDefault(); } }
  function keyup(event) { const key = event.key.toLowerCase(), action = key === 'a' || key === 'arrowleft' ? 'left' : key === 'd' || key === 'arrowright' ? 'right' : key === 'w' || key === 'arrowup' ? 'up' : key === 's' || key === 'arrowdown' ? 'down' : key === 'shift' ? 'fine' : null; if (action) setHeld(action, `key:${key}`, false); }
  function touchSetup() { document.querySelectorAll('[data-touch]').forEach((button) => { const action = button.dataset.touch; button.addEventListener('pointerdown', (event) => { if (screen !== 'play') return; event.preventDefault(); if (run?.status === 'prepare' && !held[action].size) cursorClock = 0; setHeld(action, `touch:${event.pointerId}`, true); if (run?.status === 'prepare' && action !== 'fine') moveCursor(action === 'right' ? 1 : action === 'left' ? -1 : 0, action === 'down' ? 1 : action === 'up' ? -1 : 0); button.classList.add('held'); try { button.setPointerCapture(event.pointerId); } catch (_) {} }); const release = (event) => { setHeld(action, `touch:${event.pointerId}`, false); button.classList.remove('held'); }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release); }); }
  app.addEventListener('click', (event) => { const voyageButton = event.target.closest('[data-voyage-id]'); if (voyageButton && !voyageButton.disabled) { selectedVoyage = voyageButton.dataset.voyageId; renderSelect(); return; } const tool = event.target.closest('[data-tool]'); if (tool) { selectedTool = tool.dataset.tool; renderPlay(); return; } const button = event.target.closest('[data-action]'); if (!button || button.disabled) return; const action = button.dataset.action; if (action === 'start' || action === 'begin' || action === 'launch' || action === 'place' || action === 'remove' || action === 'resume' || action === 'next' || action === 'retry') unlockAudio(); if (action === 'start') show('select'); else if (action === 'begin') { if (screen === 'title') continueRun(); else startRun(); } else if (action === 'launch') launch(); else if (action === 'place') placeCurrent(); else if (action === 'remove') removeCurrent(); else if (action === 'resume') { audio.resume?.(); show('play'); } else if (action === 'pause' && screen === 'play') { previousScreen = 'play'; audio.pause?.(); show('pause'); } else if (action === 'next') nextStage(); else if (action === 'retry') { selectedVoyage = run?.voyageId || selectedVoyage; startRun(); } else if (action === 'restart') { run = null; show('select'); } else if (action === 'guide') { guideReturn = screen; show('guide'); } else if (action === 'back') { if (screen === 'guide') show(guideReturn); else if (screen === 'select') show('title'); else if (screen === 'pause' || screen === 'clear' || screen === 'defeat') { run = null; show('select'); } else show(previousScreen); } else if (action === 'mute') { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); } });
  canvas.addEventListener('click', (event) => { if (screen !== 'play' || run?.status !== 'prepare') return; const picked = scene?.pick?.(event.clientX, event.clientY); if (picked) { cursor = { col: picked.col, row: picked.row }; placeCurrent(); } }); canvas.addEventListener('contextmenu', (event) => { event.preventDefault(); if (screen !== 'play' || run?.status !== 'prepare') return; const picked = scene?.pick?.(event.clientX, event.clientY); if (picked) { cursor = { col: picked.col, row: picked.row }; removeCurrent(); } });
  window.addEventListener('blur', () => { clearInputs(); if (screen === 'play') { previousScreen = 'play'; audio.pause?.(); show('pause'); } }); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInputs(); if (screen === 'play') { audio.pause?.(); show('pause'); } } }); window.addEventListener('resize', () => scene?.resize?.()); document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); touchSetup();
  document.getElementById('volume-range')?.addEventListener('input', (event) => { settings.volume = Math.max(0, Math.min(1, finite(event.target.value))); saveSettings(); audio.setVolume?.(settings.volume); }); document.getElementById('mode-select')?.addEventListener('change', (event) => { settings.mode = event.target.value === 'gentle' ? 'gentle' : 'standard'; saveSettings(); renderSelect(); });
  Object.defineProperty(window, '__tender', { configurable: false, enumerable: true, get: () => ({ get ready() { return true; }, get screen() { return screen; }, get run() { return clone(run); }, get settings() { return clone(settings); }, get records() { return clone(records); }, get sceneStats() { return clone(scene?.stats || {}); }, get cursor() { return clone(cursor); } }) });
  scene?.resize?.(); render(); requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot(); }

import { BUILDINGS, CELL, getVoyage, starterStructures, TUNING } from './voyages.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function pushEvent(events, value) {
  events.push({ ...value });
}

function deny(run, events, reason) {
  pushEvent(events, { type: 'denied', reason, text: reason });
  if (run) run.events = events;
  return events;
}

function validCell(col, row) {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < TUNING.size && row >= 0 && row < TUNING.size;
}

function occupied(run, col, row) {
  return run.structures.find((structure) => structure.col === col && structure.row === row) || null;
}

function structureCapacity(run) {
  return run.structures.reduce((sum, structure) => sum + BUILDINGS[structure.type].capacity, 0);
}

function cabinAssignmentCounts(run) {
  const counts = new Map(run.structures.filter((structure) => structure.type === 'cabin').map((structure) => [structure.id, 0]));
  for (const resident of run.residents) if (resident.cabinId && counts.has(resident.cabinId)) counts.set(resident.cabinId, counts.get(resident.cabinId) + 1);
  return counts;
}

function sourcePosition(stage, index, count) {
  const offset = -TUNING.arrivalSpread + (index + .5) * (TUNING.arrivalSpread * 2 / Math.max(1, count));
  if (stage.side === 'west') return { x: -TUNING.arrivalEdge, z: offset };
  if (stage.side === 'east') return { x: TUNING.arrivalEdge, z: offset };
  if (stage.side === 'north') return { x: offset, z: -TUNING.arrivalEdge };
  return { x: offset, z: TUNING.arrivalEdge };
}

function cabinPosition(structure) {
  return { x: structure.x, z: structure.z };
}

function assignCabin(run, position) {
  const counts = cabinAssignmentCounts(run);
  let best = null;
  for (const structure of run.structures) {
    if (structure.type !== 'cabin') continue;
    const capacity = BUILDINGS.cabin.capacity;
    const used = counts.get(structure.id) || 0;
    if (used >= capacity) continue;
    const candidate = { structure, distance: distance(position, structure) };
    if (!best || candidate.distance < best.distance || candidate.distance === best.distance && structure.id < best.structure.id) best = candidate;
  }
  return best?.structure || null;
}

function spawnArrivals(run, voyage, stage) {
  const count = stage.count;
  const arrivalSpan = Math.max(0, stage.duration - TUNING.arrivalEndPadding - TUNING.arrivalStart);
  const arrivals = [];
  for (let index = 0; index < count; index += 1) {
    const arrivalAt = TUNING.arrivalStart + (count <= 1 ? 0 : arrivalSpan * index / (count - 1));
    const arrivalKey = `${run.stageIndex}:${index}`;
    if (run.stageTime + 1e-9 < arrivalAt || run._arrived.includes(arrivalKey)) continue;
    run._arrived.push(arrivalKey);
    const position = sourcePosition(stage, index, count);
    const cabin = assignCabin(run, position);
    if (!cabin) continue;
    const resident = { id: `${voyage.id}-resident-${run.residents.length + 1}`, x: position.x, z: position.z, cabinId: cabin.id, settled: false };
    run.residents.push(resident);
    run.rescued += 1;
    arrivals.push(resident);
  }
  return arrivals;
}

function settleResidents(run, dt) {
  for (const resident of run.residents) {
    if (resident.settled) continue;
    const cabin = run.structures.find((structure) => structure.id === resident.cabinId);
    if (!cabin) continue;
    const target = cabinPosition(cabin), gap = distance(resident, target);
    if (gap <= TUNING.residentSpeed * dt) {
      resident.x = target.x; resident.z = target.z; resident.settled = true;
    } else {
      resident.x += (target.x - resident.x) / gap * TUNING.residentSpeed * dt;
      resident.z += (target.z - resident.z) / gap * TUNING.residentSpeed * dt;
    }
  }
}

function stageWind(run, voyage) {
  const stage = voyage.stages[run.stageIndex];
  if (!stage) return { x: 0, z: 0 };
  const t = run.stageTime;
  const strength = .65 + .35 * Math.sin(t * .45);
  const windScale = run.mode === 'gentle' ? TUNING.gentleWind : 1;
  return {
    x: (stage.force.x * strength + TUNING.windRippleX * Math.sin(t * .73 + run.stageIndex * 1.7)) * windScale,
    z: (stage.force.z * strength + TUNING.windRippleZ * Math.sin(t * .61 + run.stageIndex * 2.3 + .8)) * windScale
  };
}

export function metrics(run) {
  if (!run) return { mass: 0, buoyancy: 0, momentX: 0, momentZ: 0, pumps: 0, capacity: 0 };
  let structureMass = 0, buoyancy = TUNING.baseBuoyancy, momentX = TUNING.tankMass * finite(run.tank?.x), momentZ = TUNING.tankMass * finite(run.tank?.z), pumps = 0;
  for (const structure of run.structures || []) {
    const definition = BUILDINGS[structure.type];
    if (!definition) continue;
    structureMass += definition.mass;
    buoyancy += definition.lift;
    momentX += (definition.mass - definition.lift) * structure.x;
    momentZ += (definition.mass - definition.lift) * structure.z;
    if (structure.type === 'pump') pumps += 1;
  }
  for (const resident of run.residents || []) {
    momentX += TUNING.residentMass * resident.x;
    momentZ += TUNING.residentMass * resident.z;
  }
  const mass = TUNING.raftMass + TUNING.tankMass + structureMass + (run.residents?.length || 0) * TUNING.residentMass + finite(run.water) * TUNING.floodMass;
  return { mass, buoyancy, momentX, momentZ, pumps, capacity: structureCapacity(run) };
}

export function preflight(run) {
  const voyage = getVoyage(run?.voyageId);
  const capacity = metrics(run).capacity, required = voyage?.total || 0;
  if (!voyage) return { ok: false, reason: '알 수 없는 항해입니다.', capacity, required };
  if (capacity < required) return { ok: false, reason: `쉼터 수용량이 부족합니다. ${required}명이 필요합니다.`, capacity, required };
  return { ok: true, reason: '출항 준비가 되었습니다.', capacity, required };
}

function updateFreeboard(run) {
  const state = metrics(run);
  run.freeboard = clamp(TUNING.freeboardBase + (state.buoyancy - state.mass) * TUNING.freeboardFactor, TUNING.freeboardMin, TUNING.freeboardMax);
  return state;
}

function finish(run, events, status, reason) {
  if (run.status !== 'storm') return;
  run.status = status;
  pushEvent(events, { type: status === 'won' ? 'win' : 'lose', reason, text: reason });
}

function updateStorm(run, voyage, input, dt, events) {
  const axisX = clamp(finite(Number(input?.x)), -1, 1), axisZ = clamp(finite(Number(input?.z)), -1, 1);
  const magnitude = Math.hypot(axisX, axisZ), norm = Math.max(1, magnitude);
  const speed = TUNING.tankSpeed * (input?.fine ? .5 : 1);
  if (magnitude > 0) {
    run.tank.x = clamp(run.tank.x + axisX / norm * speed * dt, -TUNING.tankRange, TUNING.tankRange);
    run.tank.z = clamp(run.tank.z + axisZ / norm * speed * dt, -TUNING.tankRange, TUNING.tankRange);
  }
  run.wind = stageWind(run, voyage);
  const state = updateFreeboard(run);
  const accelX = TUNING.torqueScale * (state.momentX + run.wind.x) - TUNING.spring * run.roll - TUNING.damping * run.rollVelocity;
  const accelZ = TUNING.torqueScale * (state.momentZ + run.wind.z) - TUNING.spring * run.pitch - TUNING.damping * run.pitchVelocity;
  run.rollVelocity += accelX * dt;
  run.pitchVelocity += accelZ * dt;
  run.roll += run.rollVelocity * dt;
  run.pitch += run.pitchVelocity * dt;
  const swell = TUNING.swellBase + TUNING.swellAmplitude * Math.sin(run.stageTime * .9);
  const clearance = run.freeboard - TUNING.halfDeck * Math.abs(run.roll) - TUNING.halfDeck * Math.abs(run.pitch) - swell;
  const pumpFactor = Math.max(.15, 1 - (Math.abs(run.roll) + Math.abs(run.pitch)) / .8);
  const floodGain = Math.max(0, -clearance) * TUNING.floodRate * (run.mode === 'gentle' ? TUNING.gentleFlood : 1);
  run.water = clamp(run.water + (floodGain - TUNING.passiveDrain - TUNING.pumpRate * state.pumps * pumpFactor) * dt, 0, 1);
  run.capsizeTime = Math.max(0, run.capsizeTime + (Math.max(Math.abs(run.roll), Math.abs(run.pitch)) > TUNING.capsizeAngle ? dt : -2 * dt));
  run.stats.peakWater = Math.max(run.stats.peakWater, run.water);
  run.stats.peakTilt = Math.max(run.stats.peakTilt, Math.max(Math.abs(run.roll), Math.abs(run.pitch)));
  run.stats.stormTime += dt;
  run.stageTime += dt;
  run.time += dt;
  settleResidents(run, dt);
  for (const resident of spawnArrivals(run, voyage, voyage.stages[run.stageIndex])) pushEvent(events, { type: 'arrival', id: resident.id, cabinId: resident.cabinId });
  if (run.water >= 1 - 1e-9) return finish(run, events, 'lost', '침수가 한계에 도달했습니다.');
  if (run.capsizeTime >= TUNING.capsizeDuration - 1e-9) return finish(run, events, 'lost', '배가 너무 오래 기울었습니다.');
  const stage = voyage.stages[run.stageIndex];
  if (run.stageTime < stage.duration - 1e-9) return;
  run.stageIndex += 1;
  for (const resident of run.residents) {
    const cabin = run.structures.find((structure) => structure.id === resident.cabinId);
    if (cabin) { resident.x = cabin.x; resident.z = cabin.z; }
    resident.settled = true;
  }
  pushEvent(events, { type: 'stage-clear', stageIndex: run.stageIndex });
  if (run.stageIndex >= voyage.stages.length) {
    if (run.rescued >= voyage.total) finish(run, events, 'won', '모든 주민이 항구에 도착했습니다.');
    else finish(run, events, 'lost', '모든 주민을 태우지 못했습니다.');
    return;
  }
  run.status = 'prepare';
  run.budget += TUNING.repairWood;
  run.stageTime = 0;
  run.roll = 0; run.pitch = 0; run.rollVelocity = 0; run.pitchVelocity = 0;
  run.water = Math.max(0, run.water - TUNING.repairDrain);
  run.wind = { x: 0, z: 0 };
  updateFreeboard(run);
}

export function createRun(voyageId = 'first-rescue', mode = 'standard') {
  const voyage = getVoyage(voyageId);
  if (!voyage) throw new RangeError(`unknown voyage: ${voyageId}`);
  const starter = starterStructures().map(({ type, col, row }, index) => {
    const position = { x: (col - 2.5) * CELL, z: (row - 2.5) * CELL };
    return { id: `starter-${type}-${index}`, type, col, row, ...position };
  });
  const run = {
    voyageId, mode: mode === 'gentle' ? 'gentle' : 'standard', status: 'prepare', stageIndex: 0, stageTime: 0, time: 0,
    budget: voyage.budget, structures: starter, residents: [], tank: { x: 0, z: 0 }, roll: 0, pitch: 0, rollVelocity: 0, pitchVelocity: 0,
    water: 0, freeboard: 0, wind: { x: 0, z: 0 }, capsizeTime: 0, rescued: 0, events: [], stats: { peakWater: 0, peakTilt: 0, stormTime: 0 },
    _arrived: [], _structureSerial: starter.length
  };
  updateFreeboard(run);
  return run;
}

export function placeBuilding(run, type, col, row) {
  const events = [];
  if (!run || run.status !== 'prepare') return deny(run, events, '준비 단계에서만 건설할 수 있습니다.');
  const definition = BUILDINGS[type];
  if (!definition) return deny(run, events, '알 수 없는 건설물입니다.');
  if (!validCell(col, row)) return deny(run, events, '갑판 밖에는 건설할 수 없습니다.');
  if (occupied(run, col, row)) return deny(run, events, '그 칸은 이미 사용 중입니다.');
  if (run.budget < definition.cost) return deny(run, events, '목재가 부족합니다.');
  const position = { x: (col - 2.5) * CELL, z: (row - 2.5) * CELL };
  const structure = { id: `${type}-${run._structureSerial += 1}`, type, col, row, ...position };
  run.structures.push(structure); run.budget -= definition.cost;
  pushEvent(events, { type: 'placed', id: structure.id, buildingType: structure.type, col, row });
  run.events = events;
  updateFreeboard(run);
  return events;
}

export function removeBuilding(run, col, row) {
  const events = [];
  if (!run || run.status !== 'prepare') return deny(run, events, '준비 단계에서만 철거할 수 있습니다.');
  const structure = occupied(run, col, row);
  if (!structure) return deny(run, events, '철거할 건설물이 없습니다.');
  if (run.residents.some((resident) => resident.cabinId === structure.id)) return deny(run, events, '주민이 배정된 쉼터는 철거할 수 없습니다.');
  run.structures = run.structures.filter((candidate) => candidate !== structure);
  const refund = BUILDINGS[structure.type].cost;
  run.budget += refund;
  pushEvent(events, { type: 'removed', id: structure.id, refund });
  run.events = events;
  updateFreeboard(run);
  return events;
}

export function launchStage(run) {
  const events = [];
  if (!run || run.status !== 'prepare') return deny(run, events, '준비 단계에서만 출항할 수 있습니다.');
  const check = preflight(run);
  if (!check.ok) return deny(run, events, check.reason);
  const voyage = getVoyage(run.voyageId);
  if (run.stageIndex >= voyage.stages.length) return deny(run, events, '모든 항해를 마쳤습니다.');
  run.status = 'storm'; run.stageTime = 0; run.wind = { ...voyage.stages[run.stageIndex].force };
  pushEvent(events, { type: 'launch', stageIndex: run.stageIndex, force: { ...voyage.stages[run.stageIndex].force } });
  run.events = events;
  return events;
}

export function stepRun(run, input = {}, dt = 0) {
  if (!run || run.status !== 'storm') { if (run) run.events = []; return []; }
  const duration = clamp(finite(Number(dt)), 0, TUNING.maxDt);
  const events = [];
  if (duration <= 0) { run.events = []; return []; }
  const voyage = getVoyage(run.voyageId);
  let remaining = duration;
  while (remaining > 1e-9 && run.status === 'storm') {
    const slice = Math.min(TUNING.fixedStep, remaining);
    updateStorm(run, voyage, input, slice, events);
    remaining -= slice;
  }
  run.events = events;
  return events;
}

export function summarize(run) {
  const won = run?.status === 'won';
  let grade = null;
  if (won) grade = run. stats.peakWater < .25 && run.stats.peakTilt < .3 ? 'S' : run.stats.peakWater < .65 ? 'A' : 'B';
  return {
    voyageId: run?.voyageId, mode: run?.mode, status: run?.status, rescued: run?.rescued ?? 0,
    total: getVoyage(run?.voyageId)?.total ?? 0, water: run?.water ?? 0, peakWater: run?.stats?.peakWater ?? 0,
    peakTilt: run?.stats?.peakTilt ?? 0, stormTime: run?.stats?.stormTime ?? 0, grade
  };
}

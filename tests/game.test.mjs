import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, getVoyage, TUNING, VOYAGES, cellToWorld, worldToCell } from '../src/voyages.js';
import { createRun, launchStage, metrics, placeBuilding, preflight, removeBuilding, stepRun } from '../src/game.js';

function advance(run, seconds, input = {}) {
  const steps = Math.ceil(seconds / (1 / 60));
  for (let index = 0; index < steps && run.status === 'storm'; index += 1) stepRun(run, input, Math.min(1 / 60, seconds - index / 60));
}

function ballastInput(run) {
  const state = metrics(run);
  const targetX = Math.max(-TUNING.tankRange, Math.min(TUNING.tankRange, -(state.momentX + run.wind.x) / TUNING.tankMass));
  const targetZ = Math.max(-TUNING.tankRange, Math.min(TUNING.tankRange, -(state.momentZ + run.wind.z) / TUNING.tankMass));
  return { x: Math.sign(targetX - run.tank.x), z: Math.sign(targetZ - run.tank.z) };
}

function finishByBallast(run) {
  let guard = 0;
  launchStage(run);
  while (run.status === 'storm' && guard < 30000) { stepRun(run, ballastInput(run), 1 / 60); guard += 1; }
  while (run.status === 'prepare' && guard < 30000) {
    assert.equal(launchStage(run).some((event) => event.type === 'launch'), true);
    while (run.status === 'storm' && guard < 30000) { stepRun(run, ballastInput(run), 1 / 60); guard += 1; }
  }
  assert.ok(guard < 30000, 'ballast controller terminates');
}

function preparedStandard(voyageId) {
  const run = createRun(voyageId, 'standard');
  const additions = voyageId === 'cross-current'
    ? [['cabin', 2, 2], ['pontoon', 1, 1], ['pontoon', 4, 4], ['pontoon', 1, 4], ['pontoon', 4, 1], ['pump', 2, 4], ['pump', 3, 4]]
    : voyageId === 'last-harbor'
      ? [['cabin', 2, 2], ['cabin', 3, 2], ['pontoon', 1, 1], ['pontoon', 4, 4], ['pontoon', 1, 4], ['pontoon', 4, 1], ['pump', 2, 3], ['pump', 3, 3]]
      : [];
  for (const addition of additions) assert.equal(placeBuilding(run, ...addition).some((event) => event.type === 'placed'), true);
  return run;
}

test('authored voyages, building data and world coordinates are stable', () => {
  assert.deepEqual(VOYAGES.map((voyage) => [voyage.id, voyage.stages.length, voyage.total]), [['first-rescue', 2, 10], ['cross-current', 3, 18], ['last-harbor', 3, 24]]);
  assert.deepEqual(Object.keys(BUILDINGS), ['pontoon', 'cabin', 'pump']);
  assert.deepEqual(worldToCell(...Object.values(cellToWorld(0, 0))), { col: 0, row: 0 });
  assert.deepEqual(TUNING.size, 6);
  assert.equal(TUNING.tankRange, 3.6);
});

test('preflight and preparation actions enforce capacity, occupancy and refunds', () => {
  const run = createRun('cross-current', 'gentle');
  assert.equal(preflight(run).ok, false);
  assert.equal(placeBuilding(run, 'cabin', 2, 2).some((event) => event.type === 'placed'), true);
  assert.equal(preflight(run).ok, true);
  const before = run.budget;
  assert.equal(placeBuilding(run, 'pump', 3, 3).some((event) => event.type === 'placed'), true);
  assert.equal(run.budget, before - BUILDINGS.pump.cost);
  assert.equal(placeBuilding(run, 'pump', 3, 3)[0].type, 'denied');
  assert.equal(removeBuilding(run, 3, 3)[0].type, 'removed');
  assert.equal(run.budget, before);
  assert.equal(placeBuilding(run, 'unknown', 3, 3)[0].type, 'denied');
  assert.equal(placeBuilding(undefined, 'pump', 0, 0)[0].type, 'denied');
  const starterRun = createRun('first-rescue'), starterBudget = starterRun.budget;
  assert.equal(removeBuilding(starterRun, 0, 0).some((event) => event.type === 'removed' && event.refund === BUILDINGS.pontoon.cost), true);
  assert.equal(starterRun.budget, starterBudget + BUILDINGS.pontoon.cost);
  assert.equal(removeBuilding(starterRun, 0, 0)[0].type, 'denied');
  assert.equal(starterRun.budget, starterBudget + BUILDINGS.pontoon.cost);
  assert.equal(placeBuilding(starterRun, 'pontoon', 0, 0).some((event) => event.type === 'placed'), true);
  assert.equal(starterRun.budget, starterBudget);
});

test('structure identifiers remain unique across deletion and reassignment', () => {
  const run = createRun('cross-current', 'gentle');
  placeBuilding(run, 'cabin', 2, 2);
  placeBuilding(run, 'cabin', 3, 2);
  const removedId = run.structures.find((structure) => structure.col === 2 && structure.row === 2).id;
  assert.equal(removeBuilding(run, 2, 2)[0].type, 'removed');
  placeBuilding(run, 'cabin', 2, 3);
  const cabinIds = run.structures.filter((structure) => structure.type === 'cabin').map((structure) => structure.id);
  assert.equal(new Set(cabinIds).size, cabinIds.length);
  assert.equal(cabinIds.includes(removedId), false);
  assert.equal(preflight(run).capacity, 24);
  launchStage(run);
  advance(run, 40);
  assert.equal(run.status, 'prepare');
  assert.equal(run.residents.every((resident) => cabinIds.includes(resident.cabinId)), true);
  const assigned = run.residents[0].cabinId;
  const assignedCabin = run.structures.find((structure) => structure.id === assigned);
  assert.equal(removeBuilding(run, assignedCabin.col, assignedCabin.row)[0].type, 'denied');
});

test('resident assignment consumes cabin capacity and assigned shelters cannot be removed', () => {
  const run = createRun('first-rescue');
  assert.equal(launchStage(run).some((event) => event.type === 'launch'), true);
  advance(run, 35);
  assert.equal(run.status, 'prepare');
  assert.equal(run.rescued, 5);
  assert.ok(run.residents.every((resident) => resident.cabinId && resident.settled));
  assert.equal(removeBuilding(run, 1, 2)[0].type, 'denied');
  assert.equal(run.stageIndex, 1);
  assert.equal(run.budget, getVoyage('first-rescue').budget + TUNING.repairWood);
});

test('storm axes, diagonal tank normalization and fixed-step partition are deterministic', () => {
  const run = createRun('first-rescue');
  launchStage(run);
  stepRun(run, { x: 1, z: 0 }, 1);
  assert.ok(run.tank.x > 0 && Math.abs(run.tank.z) < 1e-9);
  assert.ok(run.tank.x < TUNING.tankRange && run.tank.x > 2.9);
  const diagonal = createRun('first-rescue'); launchStage(diagonal); stepRun(diagonal, { x: 1, z: 1 }, 1);
  assert.ok(Math.abs(diagonal.tank.x - diagonal.tank.z) < 1e-9);
  const standardWind = createRun('first-rescue', 'standard'), gentleWind = createRun('first-rescue', 'gentle');
  launchStage(standardWind); launchStage(gentleWind); stepRun(standardWind, {}, 10); stepRun(gentleWind, {}, 10);
  assert.ok(Math.abs(gentleWind.wind.x - standardWind.wind.x * TUNING.gentleWind) < 1e-9);
  assert.ok(Math.abs(gentleWind.wind.z - standardWind.wind.z * TUNING.gentleWind) < 1e-9);
  const a = createRun('first-rescue'), b = createRun('first-rescue'); launchStage(a); launchStage(b);
  stepRun(a, { x: -1, z: .5, fine: true }, .75);
  for (let index = 0; index < 45; index += 1) stepRun(b, { x: -1, z: .5, fine: true }, 1 / 60);
  for (const field of ['tank', 'roll', 'pitch', 'water', 'stageTime']) {
    if (typeof a[field] === 'object') assert.ok(Math.hypot(a[field].x - b[field].x, a[field].z - b[field].z) < 1e-8, field);
    else assert.ok(Math.abs(a[field] - b[field]) < 1e-8, field);
  }
});

test('stage transition settles arrivals, grants repair wood and wins without an extra input', () => {
  const run = createRun('first-rescue');
  launchStage(run); advance(run, 35); launchStage(run); advance(run, 40);
  assert.equal(run.status, 'won');
  assert.equal(run.stageIndex, 2);
  assert.equal(run.rescued, 10);
  assert.equal(run.residents.every((resident) => resident.settled), true);
  assert.ok(run.events.some((event) => event.type === 'win'));
  const snapshot = { status: run.status, time: run.time, rescued: run.rescued };
  assert.deepEqual(stepRun(run, {}, 5), []);
  assert.deepEqual({ status: run.status, time: run.time, rescued: run.rescued }, snapshot);
});

test('standard ballast controller survives all three voyages with authored construction', () => {
  for (const voyage of VOYAGES) {
    const run = preparedStandard(voyage.id);
    assert.equal(preflight(run).ok, true);
    finishByBallast(run);
    assert.equal(run.status, 'won', voyage.id);
    assert.equal(run.rescued, voyage.total);
    assert.ok(run.stats.peakTilt < .55, voyage.id);
  }
});

test('untrimmed builds flood in standard mode while gentle mode reduces the same storm', () => {
  const standard = createRun('cross-current', 'standard');
  const gentle = createRun('cross-current', 'gentle');
  for (const run of [standard, gentle]) { placeBuilding(run, 'cabin', 2, 2); launchStage(run); advance(run, 40); if (run.status === 'prepare') launchStage(run); }
  assert.equal(standard.status, 'storm');
  advance(standard, 40, { x: 0, z: 0 });
  advance(gentle, 40, { x: 0, z: 0 });
  assert.equal(standard.status, 'lost');
  assert.ok(gentle.water < standard.water || gentle.stats.peakTilt < standard.stats.peakTilt);
  const snapshot = { status: standard.status, time: standard.time, water: standard.water };
  assert.deepEqual(stepRun(standard, { x: 1, z: 1 }, 2), []);
  assert.deepEqual({ status: standard.status, time: standard.time, water: standard.water }, snapshot);
});

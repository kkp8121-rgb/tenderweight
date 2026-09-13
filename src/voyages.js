export const CELL = 1.8;

export const BUILDINGS = Object.freeze({
  pontoon: Object.freeze({ id: 'pontoon', name: '부력통', cost: 3, mass: .35, lift: 2.4, capacity: 0, description: '선체를 넓히고 부력을 더합니다.' }),
  cabin: Object.freeze({ id: 'cabin', name: '쉼터', cost: 4, mass: 2.4, lift: 0, capacity: 6, description: '주민 여섯 명을 안전하게 맞이합니다.' }),
  pump: Object.freeze({ id: 'pump', name: '배수기', cost: 4, mass: 1.2, lift: 0, capacity: 0, description: '기울어진 갑판의 물을 빼냅니다.' })
});

export const TUNING = Object.freeze({
  size: 6, cell: CELL, halfDeck: 5.4, raftMass: 12, tankMass: 6, tankRange: 3.6, tankSpeed: 3,
  residentMass: .55, residentSpeed: 1.2, baseBuoyancy: 26, floodMass: 10,
  freeboardBase: .52, freeboardFactor: .015, freeboardMin: .12, freeboardMax: .75,
  torqueScale: .035, spring: 3.2, damping: 2.6, pumpRate: .007, passiveDrain: .003,
  floodRate: .035, capsizeAngle: .55, capsizeDuration: 2, repairWood: 4, repairDrain: .2,
  gentleWind: .7, gentleFlood: .65, cabinFloor: .65, cabinRoofHeight: 2.3,
  tankBottom: 3, personHeight: .5, fixedStep: 1 / 60, maxDt: 5,
  windRippleX: 2, windRippleZ: 1, swellBase: .06, swellAmplitude: .06,
  arrivalEdge: 5, arrivalSpread: 2.7, arrivalStart: 6, arrivalEndPadding: 10
});

const starter = [
  ['pontoon', 0, 0], ['pontoon', 5, 0], ['pontoon', 0, 5], ['pontoon', 5, 5],
  ['cabin', 1, 2], ['cabin', 4, 3]
];

export const VOYAGES = Object.freeze([
  Object.freeze({
    id: 'first-rescue', title: '작은 무게부터', budget: 12, total: 10,
    intro: '처음에는 작은 움직임이면 충분합니다. 뜬 쪽으로 평형추를 옮기세요.',
    stages: Object.freeze([
      Object.freeze({ duration: 35, force: Object.freeze({ x: 12, z: 3 }), count: 5, side: 'west' }),
      Object.freeze({ duration: 40, force: Object.freeze({ x: -17, z: 5 }), count: 5, side: 'east' })
    ])
  }),
  Object.freeze({
    id: 'cross-current', title: '서로 다른 방향', budget: 24, total: 18,
    intro: '사람과 바람은 같은 쪽에서 오지 않습니다. 쉼터의 자리도 무게입니다.',
    stages: Object.freeze([
      Object.freeze({ duration: 40, force: Object.freeze({ x: 20, z: -9 }), count: 6, side: 'north' }),
      Object.freeze({ duration: 40, force: Object.freeze({ x: -22, z: 14 }), count: 6, side: 'east' }),
      Object.freeze({ duration: 45, force: Object.freeze({ x: 16, z: 20 }), count: 6, side: 'south' })
    ])
  }),
  Object.freeze({
    id: 'last-harbor', title: '모두를 위한 항구', budget: 34, total: 24,
    intro: '마지막 항구까지 한 사람도 두고 가지 않습니다.',
    stages: Object.freeze([
      Object.freeze({ duration: 45, force: Object.freeze({ x: 24, z: 14 }), count: 8, side: 'west' }),
      Object.freeze({ duration: 45, force: Object.freeze({ x: -27, z: 18 }), count: 8, side: 'south' }),
      Object.freeze({ duration: 50, force: Object.freeze({ x: 22, z: -26 }), count: 8, side: 'east' })
    ])
  })
]);

export function getVoyage(id) {
  return VOYAGES.find((voyage) => voyage.id === id) || null;
}

export function cellToWorld(col, row) {
  return { x: (Number(col) - 2.5) * CELL, z: (Number(row) - 2.5) * CELL };
}

export function worldToCell(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { col: Math.floor(x / CELL + 3), row: Math.floor(z / CELL + 3) };
}

export function starterStructures() {
  return starter.map(([type, col, row]) => ({ type, col, row }));
}

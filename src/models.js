import * as THREE from 'three';
import { BUILDINGS, TUNING } from './voyages.js';

const palette = { sea: 0x79c8c9, seaDeep: 0x277f98, deck: 0xf0c177, deckDark: 0x9b6247, ivory: 0xfff2d5, coral: 0xe87867, coralDark: 0xa8434a, yellow: 0xf7cf55, yellowBright: 0xffef8a, teal: 0x3d9c9c, navy: 0x244b68, glass: 0x9ce6dc, ink: 0x243342, foam: 0xe6faf0 };
const CELL = () => TUNING.cell;
const SIZE = () => TUNING.size;
const HALF_DECK = () => TUNING.halfDeck;
const mat = (color, options = {}) => { const material = new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .68, metalness: options.metalness ?? 0, emissive: options.emissive ?? 0, emissiveIntensity: options.emissiveIntensity ?? 0, transparent: !!options.transparent, opacity: options.opacity ?? 1 }); material.userData.disposeWithObject = true; return material; };
const mesh = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => { const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.rotation.set(...rotation); object.scale.set(...scale); return object; };
const box = (w, h, d, color, options) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, options));
const cylinder = (radius, height, color, options, segments = 12) => mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, segments), mat(color, options));
const sphere = (radius, color, options, scale = [1, 1, 1]) => mesh(new THREE.SphereGeometry(radius, 12, 8), mat(color, options), [0, 0, 0], [0, 0, 0], scale);

function addWindowBand(root, z, width = .52) { const pane = box(width, .27, .035, palette.yellowBright, { emissive: palette.yellow, emissiveIntensity: .8, roughness: .35 }); pane.position.set(0, 1.37, z); root.add(pane); const mullion = box(.035, .27, .042, palette.coralDark, { roughness: .5 }); mullion.position.set(0, 1.37, z + (z > 0 ? .022 : -.022)); root.add(mullion); }

export function createDeck() {
  const size = HALF_DECK() * 2, root = new THREE.Group(); root.name = 'six-by-six-deck';
  const platform = box(size, .24, size, palette.deck, { roughness: .76 }); platform.position.y = -.02; platform.name = 'wooden-deck'; root.add(platform);
  const border = box(size + .12, .12, .16, palette.deckDark, { roughness: .72 }); for (const x of [-size / 2, size / 2]) { const rail = border.clone(); rail.position.set(0, .17, x); root.add(rail); } for (const z of [-size / 2, size / 2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.16, .12, size + .12), border.material); rail.position.set(z, .17, 0); root.add(rail); }
  for (let i = 0; i <= SIZE(); i++) { const beam = box(size + .02, .035, .035, palette.deckDark, { roughness: .8 }); beam.position.set(0, .115, -size / 2 + i * CELL()); root.add(beam); const cross = box(.035, .035, size + .02, palette.deckDark, { roughness: .8 }); cross.position.set(-size / 2 + i * CELL(), .12, 0); root.add(cross); }
  root.userData.deckSize = size; return root;
}

export function createPontoon() {
  const root = new THREE.Group(); root.name = 'pontoon'; const hull = sphere(.62, palette.teal, { roughness: .45, metalness: .18 }, [1.65, .38, .7]); hull.position.y = -.62; root.add(hull); const keel = box(1.55, .09, .5, palette.navy, { roughness: .4, metalness: .2 }); keel.position.y = -.72; root.add(keel); const collar = cylinder(.25, .12, palette.yellow, { metalness: .35, roughness: .4 }, 10); collar.position.y = -.38; root.add(collar); const marker = box(1.05, .025, 1.05, palette.teal, { emissive: palette.teal, emissiveIntensity: .18, roughness: .65 }); marker.position.y = .13; marker.name = 'deck-type-marker'; root.add(marker); return root;
}

export function createCabin() {
  const root = new THREE.Group(); root.name = 'cabin';
  const floorY = TUNING.cabinFloor, roofY = TUNING.cabinRoofHeight; for (const x of [-.63, .63]) for (const z of [-.48, .48]) { const stilt = box(.13, floorY, .13, palette.coralDark, { roughness: .72 }); stilt.position.set(x, floorY / 2, z); root.add(stilt); }
  const floor = box(1.55, .12, 1.35, palette.deckDark, { roughness: .7 }); floor.position.y = floorY + .06; root.add(floor);
  const wallHeight = roofY - .46 - floorY - .12, wall = box(1.48, wallHeight, 1.22, palette.ivory, { roughness: .7 }); wall.position.y = floorY + .12 + wallHeight / 2; root.add(wall);
  const front = box(.34, .46, .035, palette.coralDark, { roughness: .55 }); front.position.set(0, 1.1, .63); root.add(front);
  addWindowBand(root, .642); addWindowBand(root, -.642);
  const sideWindow = box(.035, .27, .48, palette.yellowBright, { emissive: palette.yellow, emissiveIntensity: .8, roughness: .35 }); sideWindow.position.set(.752, floorY + .72, 0); root.add(sideWindow); const sideWindow2 = sideWindow.clone(); sideWindow2.position.x = -.752; root.add(sideWindow2);
  const roof = mesh(new THREE.ConeGeometry(1.1, .42, 4), mat(palette.coral, { roughness: .58 }), [0, roofY - .25, 0], [0, Math.PI / 4, 0]); root.add(roof);
  const chimney = cylinder(.09, .3, palette.coralDark, { roughness: .65 }, 8); chimney.position.set(.35, roofY - .18, .18); root.add(chimney);
  const capacity = BUILDINGS.cabin.capacity, markers = []; for (let i = 0; i < capacity; i++) { const marker = box(.11, .08, .035, palette.yellowBright, { emissive: palette.yellow, emissiveIntensity: .7, roughness: .35 }); marker.position.set(-.42 + (i % 3) * .42, floorY + .28 + Math.floor(i / 3) * .16, .642); marker.visible = false; root.add(marker); markers.push(marker); } root.userData.capacity = capacity; root.userData.capacityMarkers = markers; return root;
}

export function createPump() {
  const root = new THREE.Group(); root.name = 'pump'; const base = cylinder(.34, .16, palette.navy, { metalness: .3, roughness: .42 }, 10); base.position.y = -.34; root.add(base); const body = cylinder(.22, .52, palette.yellow, { metalness: .32, roughness: .38 }, 10); body.position.y = -.56; root.add(body); const cap = sphere(.2, palette.coral, { metalness: .2, roughness: .42 }); cap.position.set(0, -.28, 0); root.add(cap); const pipe = cylinder(.055, .7, palette.ivory, { metalness: .55, roughness: .32 }, 8); pipe.position.set(.27, -.5, 0); pipe.rotation.z = Math.PI / 2; root.add(pipe); const marker = box(.72, .025, .72, palette.yellow, { emissive: palette.yellow, emissiveIntensity: .18, roughness: .62 }); marker.position.y = .13; marker.name = 'deck-type-marker'; root.add(marker); return root;
}

export function createStructure(type) { if (type === 'pontoon') return createPontoon(); if (type === 'cabin') return createCabin(); if (type === 'pump') return createPump(); return new THREE.Group(); }

export function createResident(index = 0) {
  const root = new THREE.Group(); root.name = `resident-${index}`; const coat = index % 2 ? palette.coral : palette.teal, body = box(.22, .28, .16, coat, { roughness: .7 }); body.position.y = .25; root.add(body); const head = sphere(.13, palette.ivory, { roughness: .64 }); head.position.set(0, .5, -.01); root.add(head); const cap = sphere(.14, index % 2 ? palette.yellow : palette.coralDark, { roughness: .55 }, [1, .42, 1]); cap.position.set(0, .61, .01); root.add(cap); for (const side of [-1, 1]) { const arm = cylinder(.035, .2, palette.ivory, { roughness: .72 }, 8); arm.position.set(side * .16, .27, -.01); arm.rotation.z = side * .2; arm.name = `arm-${side}`; root.add(arm); const leg = cylinder(.035, .16, palette.navy, { roughness: .65 }, 8); leg.position.set(side * .07, .06, 0); leg.name = `leg-${side}`; root.add(leg); } root.scale.setScalar(TUNING.personHeight / .75); root.userData.phase = index * .9; return root;
}

export function createGantry() {
  const root = new THREE.Group(); root.name = 'ballast-gantry'; const deck = HALF_DECK() * 2, postX = HALF_DECK() + .25, frameSpan = deck + .6, frameY = 4.2; for (const x of [-postX, postX]) for (const z of [-postX, postX]) { const post = box(.1, frameY, .1, palette.navy, { metalness: .3, roughness: .45 }); post.position.set(x, frameY / 2, z); root.add(post); const foot = box(.28, .08, .28, palette.yellow, { metalness: .35, roughness: .4 }); foot.position.set(x, .1, z); root.add(foot); }
  for (const x of [-postX, postX]) { const sideRail = box(.1, .1, frameSpan, palette.navy, { metalness: .55, roughness: .38 }); sideRail.position.set(x, frameY, 0); root.add(sideRail); } for (const z of [-postX, postX]) { const endBeam = box(frameSpan, .1, .1, palette.navy, { metalness: .55, roughness: .38 }); endBeam.position.set(0, frameY, z); root.add(endBeam); }
  const crossbar = box(deck * .86, .1, .14, palette.yellow, { metalness: .48, roughness: .35 }); crossbar.position.set(0, frameY, 0); crossbar.name = 'tank-crossbar'; root.add(crossbar); root.userData.crossbar = crossbar; root.userData.tankY = 3.72; return root;
}

export function createBallastTank() { const root = new THREE.Group(); root.name = 'ballast-tank'; const body = mesh(new THREE.CylinderGeometry(.34, .4, .52, 12), mat(palette.yellow, { metalness: .38, roughness: .35 }), [0, 0, 0], [0, 0, Math.PI / 2]); root.add(body); const stripe = mesh(new THREE.TorusGeometry(.35, .035, 6, 14), mat(palette.coral, { metalness: .3, roughness: .4 }), [0, .0, 0], [0, Math.PI / 2, 0]); root.add(stripe); const hook = cylinder(.035, .3, palette.navy, { metalness: .6, roughness: .3 }, 8); hook.position.y = -.4; root.add(hook); const cable = cylinder(.025, .48, palette.navy, { metalness: .6, roughness: .3 }, 8); cable.position.y = .24; root.add(cable); root.userData.bottom = -.66; return root; }

export function disposeModel(root) { if (!root) return; const geometries = new Set(), materials = new Set(); root.traverse((object) => { if (object.geometry) geometries.add(object.geometry); const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []; list.forEach((material) => materials.add(material)); }); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); root.clear(); }

export { palette };

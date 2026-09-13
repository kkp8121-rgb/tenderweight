import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCabin, createResident, createGantry, createBallastTank, disposeModel } from '../src/models.js';
import { TUNING } from '../src/voyages.js';

const bounds = object => new THREE.Box3().setFromObject(object);

test('raised cabin has a supported roof and room for moving residents below its floor', () => {
  const cabin = createCabin(), person = createResident();
  const floor = cabin.children.find(child => child.geometry?.parameters?.width > 1.5 && child.geometry?.parameters?.height < .15);
  const wall = cabin.children.find(child => child.geometry?.parameters?.width > 1.4 && child.geometry?.parameters?.height > .8);
  const roof = cabin.children.find(child => child.geometry?.type === 'ConeGeometry');
  assert.ok(floor && wall && roof);
  assert.ok(bounds(floor).min.y >= TUNING.cabinFloor - 1e-6);
  assert.ok(Math.abs(bounds(roof).min.y - bounds(wall).max.y) < .005, 'roof contacts the supporting walls');
  assert.ok(bounds(cabin).max.y < TUNING.cabinRoofHeight);
  assert.ok(bounds(person).max.y < TUNING.personHeight);
  assert.ok(bounds(person).max.y + .175 < bounds(floor).min.y, 'resident and walking bob fit under shelter');
  assert.equal(cabin.userData.capacityMarkers.length, 6);
  disposeModel(cabin); disposeModel(person);
});

test('gantry supports every tank position while keeping all construction cells clear', () => {
  const gantry = createGantry(), tank = createBallastTank();
  const posts = gantry.children.filter(child => { const size = bounds(child).getSize(new THREE.Vector3()); return size.y > 3 && size.x < .2 && size.z < .2; });
  assert.equal(posts.length, 4);
  for (const post of posts) {
    const box = bounds(post);
    assert.ok(Math.min(Math.abs(box.min.x), Math.abs(box.max.x)) > TUNING.halfDeck);
    assert.ok(Math.min(Math.abs(box.min.z), Math.abs(box.max.z)) > TUNING.halfDeck);
  }
  const cabin = createCabin(), roofTop = bounds(cabin).max.y;
  for (const x of [-TUNING.tankRange, 0, TUNING.tankRange]) for (const z of [-TUNING.tankRange, 0, TUNING.tankRange]) {
    tank.position.set(x, gantry.userData.tankY - .025, z); tank.rotation.z = .03;
    assert.ok(bounds(tank).min.y > TUNING.tankBottom);
    assert.ok(bounds(tank).min.y > roofTop + .7);
  }
  assert.ok(gantry.userData.crossbar);
  disposeModel(gantry); disposeModel(tank); disposeModel(cabin);
});

test('cabin occupancy indicators do not share mutable materials across buildings', () => {
  const first = createCabin(), second = createCabin();
  first.userData.capacityMarkers[0].visible = true;
  first.userData.capacityMarkers[0].material.color.setHex(0xff0000);
  assert.equal(second.userData.capacityMarkers[0].visible, false);
  assert.notEqual(first.userData.capacityMarkers[0].material.color.getHex(), second.userData.capacityMarkers[0].material.color.getHex());
  disposeModel(first); disposeModel(second);
});

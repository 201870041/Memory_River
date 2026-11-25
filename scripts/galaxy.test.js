import test from 'node:test';
import assert from 'node:assert/strict';
import { createGalaxyData, createGalaxyPose, finalPhotoReached } from '../src/galaxy.js';

test('the galaxy starts at the final photo, not at 95% of the river', () => {
  for (const count of [2, 18, 49, 300]) {
    assert.equal(finalPhotoReached(0.95, count), false);
    assert.equal(finalPhotoReached(0.999, count), false);
    assert.equal(finalPhotoReached(1, count), true);
    assert.equal(finalPhotoReached(0.9, count), false);
  }
  assert.equal(finalPhotoReached(0.49, 1), false);
  assert.equal(finalPhotoReached(0.5, 1), true);
  assert.equal(finalPhotoReached(1, 0), false);
});

test('star and dust geometry remains finite and uses soft, bounded point sizes', () => {
  for (const dust of [false, true]) {
    const count = dust ? 3500 : 16000;
    const data = createGalaxyData(count, 42, dust);
    assert.equal(data.positions.length, count * 3);
    assert.equal(data.colors.length, count * 3);
    assert.equal(data.sizes.length, count);
    assert(data.positions.every(Number.isFinite));
    assert(data.colors.every((value) => Number.isFinite(value) && value >= 0));
    assert(data.sizes.every((value) => value > 0 && value < 51));
    for (let i = 0; i < count; i++) {
      assert(Math.abs(data.positions[i * 3]) <= 65);
      assert(Math.abs(data.positions[i * 3 + 1]) <= 65 * 0.62);
      assert(Math.abs(data.positions[i * 3 + 2]) <= 3);
    }
  }
});

test('a fixed seed creates a stable galaxy rather than a new pattern on every render', () => {
  const first = createGalaxyData(100, 42);
  const second = createGalaxyData(100, 42);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.positions, createGalaxyData(100, 73).positions);
});

test('the finale stays centered behind the last photo despite the downward camera angle', async () => {
  const THREE = await import('three');
  const { CONFIG, createRiverPath } = await import('../src/photoRiver.js');
  for (const count of [1, 18, 300]) {
    const { curve } = createRiverPath(count);
    const t = count === 1 ? 0.5 : 1;
    const point = curve.getPointAt(t), tangent = curve.getTangentAt(t).normalize();
    const camera = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 2000);
    camera.position.copy(point).addScaledVector(tangent, -CONFIG.CAMERA_DISTANCE).add(new THREE.Vector3(0, CONFIG.CAMERA_HEIGHT, 0));
    camera.lookAt(point.clone().addScaledVector(tangent, CONFIG.LOOK_AHEAD));
    camera.updateMatrixWorld();
    const galaxy = createGalaxyPose(curve, count);
    const screen = galaxy.position.clone().project(camera);
    assert(Math.abs(screen.x) < 1e-6 && Math.abs(screen.y) < 1e-6);
    assert(galaxy.position.distanceTo(camera.position) > point.distanceTo(camera.position));
  }
});

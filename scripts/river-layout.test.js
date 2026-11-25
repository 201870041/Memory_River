import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { CONFIG, createRiverPath, createPhotoPose } from '../src/photoRiver.js';

for (const count of [1, 2, 10, 18, 49, 100, 300]) {
  test(`${count} photos retain upload order, stable poses, and physical clearance`, () => {
    const { curve, spacing } = createRiverPath(count);
    const poses = Array.from({ length: count }, (_, i) => createPhotoPose(i, count, curve));
    for (let i = 0; i < count; i++) {
      assert(poses[i].position.toArray().every(Number.isFinite));
      assert(poses[i].rotation.toArray().every(Number.isFinite));
      if (i) assert(poses[i].position.z > poses[i - 1].position.z);
      const repeated = createPhotoPose(i, count, curve);
      assert.deepEqual(repeated.position.toArray(), poses[i].position.toArray());
      assert.deepEqual(repeated.rotation.toArray(), poses[i].rotation.toArray());
    }
    const boxes = poses.map(({ position, rotation }) => {
      const center = new THREE.Vector3(0, 0, -CONFIG.PHOTO_DEPTH / 2).applyQuaternion(rotation).add(position);
      return new OBB(center,
        new THREE.Vector3(CONFIG.PHOTO_WIDTH / 2, CONFIG.PHOTO_HEIGHT / 2, CONFIG.PHOTO_DEPTH / 2),
        new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(rotation)));
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) assert(!boxes[i].intersectsOBB(boxes[j]), `frames ${i} and ${j} intersect`);
    }
    if (count >= 18) assert(spacing < 5, 'spacing should stay smaller than the previous 7 units');
  });
}

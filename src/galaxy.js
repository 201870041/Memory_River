import * as THREE from 'three';
import { CONFIG } from './photoRiver.js';

export function finalPhotoReached(progress, photoCount) {
  return photoCount > 0 && progress >= (photoCount === 1 ? 0.5 : 1) - 0.000001;
}

// Seeded geometry keeps the galaxy stable across React updates.
export function createGalaxyData(count, seed = 42, dust = false) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const core = new THREE.Color('#fff0cb');
  const blue = new THREE.Color('#8ebeff');
  const violet = new THREE.Color('#a086f5');
  for (let i = 0; i < count; i++) {
    const radius = Math.pow(random(), 0.72) * 65;
    const arm = i % 5;
    const angle = arm * Math.PI * 2 / 5 + radius * 0.16 + (random() - 0.5) * (0.3 + radius / 95);
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.62;
    positions[i * 3 + 2] = (random() - 0.5) * (dust ? 6 : 3);
    const color = core.clone().lerp(blue, Math.min(1, radius / 25));
    color.lerp(violet, random() * radius / 65).multiplyScalar(dust ? 0.6 : 1.2 + random());
    color.toArray(colors, i * 3);
    sizes[i] = dust ? 18 + random() * 32 : 1.2 + Math.pow(random(), 4) * 3.2;
  }
  return { positions, colors, sizes };
}

export function createGalaxyPose(riverCurve, photoCount) {
  const t = photoCount === 1 ? 0.5 : 1;
  const point = riverCurve.getPointAt(t);
  const tangent = riverCurve.getTangentAt(t).normalize();
  const cameraPosition = point.clone().addScaledVector(tangent, -CONFIG.CAMERA_DISTANCE)
    .add(new THREE.Vector3(0, CONFIG.CAMERA_HEIGHT, 0));
  const lookTarget = point.clone().addScaledVector(tangent, CONFIG.LOOK_AHEAD);
  const direction = lookTarget.sub(cameraPosition).normalize();
  // Center on the camera's actual sightline, including its downward pitch.
  const position = cameraPosition.clone().addScaledVector(direction, 100);
  const normal = direction.negate();
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const up = normal.clone().cross(right).normalize();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  return { position, rotation };
}

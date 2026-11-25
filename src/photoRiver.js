import * as THREE from "three";

// 照片几何、路径和镜头共用同一套尺寸。
export const CONFIG = {
  PHOTO_WIDTH: 4.4,
  PHOTO_HEIGHT: 3.4,
  PHOTO_DEPTH: 0.08,
  PHOTO_SPACING: 4.6,
  PHOTO_CLEARANCE: 0.35,
  CAMERA_DISTANCE: 8,
  CAMERA_HEIGHT: 6,
  LOOK_AHEAD: 1.5,
  CAMERA_RESPONSE: 5,
  MIN_WAVE_CYCLES: 1.1,
  MAX_WAVE_CYCLES: 7,
  PHOTOS_PER_WAVE: 30,
  LATERAL_SWAY: 0.85,
};

// 连续、低频、非共面的曲线；照片数量只影响长度和缓弯次数。
export const createRiverPath = (photoCount) => {
  const count = Math.max(2, photoCount);
  const desiredLength = CONFIG.PHOTO_SPACING * (count - 1);
  const waveCycles = Math.min(
    CONFIG.MAX_WAVE_CYCLES,
    Math.max(CONFIG.MIN_WAVE_CYCLES, photoCount / CONFIG.PHOTOS_PER_WAVE)
  );
  const amplitude = Math.min(16, Math.max(2, Math.sqrt(desiredLength) * CONFIG.LATERAL_SWAY));
  const height = Math.min(5, Math.max(1, Math.sqrt(desiredLength) * 0.23));
  const sampleCount = Math.min(2048, Math.max(128, count * 4));
  const points = Array.from({ length: sampleCount + 1 }, (_, i) => {
    const t = i / sampleCount;
    const phase = t * Math.PI * 2;
    return new THREE.Vector3(
      amplitude * (Math.sin(phase * waveCycles) + 0.2 * Math.sin(phase * waveCycles * 1.55 + 0.7)),
      height * (Math.sin(phase * waveCycles * 0.63 + 0.4) + 0.25 * Math.sin(phase * 1.3)),
      (t - 0.5) * desiredLength
    );
  });
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  curve.arcLengthDivisions = Math.max(1000, sampleCount * 4);
  const initialLength = curve.getLength();
  points.forEach((p) => p.multiplyScalar(desiredLength / initialLength));
  curve.updateArcLengths();

  // Check oriented frame extents instead of oversized bounding spheres, so
  // photos can sit closer together without intersecting on a curved path.
  const poses = Array.from({ length: photoCount }, (_, i) => createPhotoPose(i, photoCount, curve));
  const halfSize = new THREE.Vector3(CONFIG.PHOTO_WIDTH / 2, CONFIG.PHOTO_HEIGHT / 2, CONFIG.PHOTO_DEPTH / 2);
  const axes = poses.map(({ rotation }) => [
    new THREE.Vector3(1, 0, 0).applyQuaternion(rotation),
    new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
    new THREE.Vector3(0, 0, 1).applyQuaternion(rotation),
  ]);
  const projectedRadius = (index, direction) =>
    Math.abs(axes[index][0].dot(direction)) * halfSize.x
    + Math.abs(axes[index][1].dot(direction)) * halfSize.y
    + Math.abs(axes[index][2].dot(direction)) * halfSize.z;
  let clearanceScale = 1;
  for (let i = 0; i < poses.length; i++) {
    for (let j = i + 1; j < poses.length; j++) {
      const direction = poses[j].position.clone().sub(poses[i].position);
      const distance = direction.length();
      direction.divideScalar(distance);
      const requiredDistance = projectedRadius(i, direction) + projectedRadius(j, direction) + CONFIG.PHOTO_CLEARANCE;
      clearanceScale = Math.max(clearanceScale, requiredDistance / distance);
    }
  }
  if (clearanceScale > 1) {
    points.forEach((point) => point.multiplyScalar(clearanceScale * 1.001));
    curve.updateArcLengths();
  }
  const riverLength = curve.getLength();
  const bounds = new THREE.Box3().setFromPoints(points);
  return {
    curve,
    riverLength,
    spacing: photoCount > 1 ? riverLength / (photoCount - 1) : 0,
    waveFrequency: waveCycles,
    waveAmplitude: (bounds.max.x - bounds.min.x) / 2,
    verticalRange: bounds.max.y - bounds.min.y,
  };
};

export function createPhotoPose(index, total, riverCurve) {
  const t = total === 1 ? 0.5 : index / (total - 1);
  const position = riverCurve.getPointAt(t);
  const tangent = riverCurve.getTangentAt(t).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = tangent.clone().cross(worldUp).normalize();
  // 像沿河摆放的相片，轻轻抬起一端，并保留可读的正面。
  const normal = worldUp.clone().multiplyScalar(0.8).addScaledVector(tangent, -0.6).normalize();
  const up = normal.clone().cross(right).normalize();
  normal.copy(right).cross(up).normalize();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, normal)
  );
  rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
    Math.sin(index * 1.7) * 0.045, 0, Math.sin(index * 2.1) * 0.065
  )));
  return { position, rotation };
}

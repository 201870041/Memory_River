import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createGalaxyData, createGalaxyPose, finalPhotoReached } from './galaxy.js';

const vertexShader = `
  attribute float aSize;
  attribute vec3 color;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * 90.0 / max(1.0, -viewPosition.z), 1.0, 96.0);
  }
`;
const fragmentShader = `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (radius > 1.0) discard;
    float glow = exp(-radius * radius * 5.0) * (1.0 - smoothstep(0.65, 1.0, radius));
    gl_FragColor = vec4(vColor, glow * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function GalaxyLayer({ data, material, uniforms }) {
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader}
        fragmentShader={fragmentShader} transparent depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

export default function GalaxyFinale({ riverCurve, photoCount, journeyRef }) {
  const group = useRef();
  const starsMaterial = useRef();
  const dustMaterial = useRef();
  const reveal = useRef(0);
  const { gl } = useThree();
  const data = useMemo(() => ({
    stars: createGalaxyData(16000, 42),
    dust: createGalaxyData(3500, 73, true),
    starUniforms: { uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    dustUniforms: { uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
  }), []);
  const pose = useMemo(() => createGalaxyPose(riverCurve, photoCount), [riverCurve, photoCount]);
  useFrame((_, delta) => {
    if (!group.current || !starsMaterial.current || !dustMaterial.current) return;
    const target = finalPhotoReached(journeyRef.current.progress, photoCount) ? 1 : 0;
    reveal.current = THREE.MathUtils.damp(reveal.current, target, 0.8, Math.min(delta, 0.1));
    group.current.visible = reveal.current > 0.001;
    // Galaxy depth is behind the final photo, so the image remains readable.
    group.current.rotateZ(delta * 0.008 * reveal.current);
    const ratio = gl.getPixelRatio();
    starsMaterial.current.uniforms.uOpacity.value = reveal.current * 0.9;
    dustMaterial.current.uniforms.uOpacity.value = reveal.current * 0.045;
    starsMaterial.current.uniforms.uPixelRatio.value = ratio;
    dustMaterial.current.uniforms.uPixelRatio.value = ratio;
  }, -1);
  return (
    <group ref={group} position={pose.position} quaternion={pose.rotation} visible={false}>
      <GalaxyLayer data={data.dust} material={dustMaterial} uniforms={data.dustUniforms} />
      <GalaxyLayer data={data.stars} material={starsMaterial} uniforms={data.starUniforms} />
    </group>
  );
}

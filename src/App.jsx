import { updatePhotoSelection } from "./photoVisibility.js";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Image, Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";

// 照片几何、路径和镜头共用同一套尺寸。
const CONFIG = {
  PHOTO_WIDTH: 4.4,
  PHOTO_HEIGHT: 3.4,
  PHOTO_DEPTH: 0.08,
  PHOTO_SPACING: 7,
  PHOTO_CLEARANCE: 1.2,
  CAMERA_DISTANCE: 8,
  CAMERA_HEIGHT: 6,
  LOOK_AHEAD: 1.5,
  CAMERA_RESPONSE: 5,
  SCREEN_GAP_PX: 12,
  MIN_WAVE_CYCLES: 1.1,
  MAX_WAVE_CYCLES: 7,
  PHOTOS_PER_WAVE: 30,
  LATERAL_SWAY: 0.85,
};

// 连续、低频、非共面的曲线；照片数量只影响长度和缓弯次数。
const createRiverPath = (photoCount) => {
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

  // 用包围球检查所有照片对。倾角改变也不会导致实体相交。
  const positions = Array.from({ length: photoCount }, (_, i) =>
    curve.getPointAt(photoCount === 1 ? 0.5 : i / (photoCount - 1))
  );
  let minDistance = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      minDistance = Math.min(minDistance, positions[i].distanceTo(positions[j]));
    }
  }
  const safeDistance = Math.hypot(CONFIG.PHOTO_WIDTH, CONFIG.PHOTO_HEIGHT, CONFIG.PHOTO_DEPTH) + CONFIG.PHOTO_CLEARANCE;
  if (minDistance < safeDistance) {
    points.forEach((p) => p.multiplyScalar(safeDistance / minDistance * 1.001));
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

function FilmFrame({ url, index, total, riverCurve, framesRef }) {
  const group = useRef();
  const image = useRef();
  const backing = useRef();
  const pose = useMemo(() => {
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
  }, [index, total, riverCurve]);

  useEffect(() => {
    const entry = { group: group.current, image: image.current, backing: backing.current, opacity: 0, selected: false, selectionOrder: 0 };
    framesRef.current[index] = entry;
    return () => { if (framesRef.current[index] === entry) delete framesRef.current[index]; };
  }, [index, framesRef]);

  return (
    <group ref={group} position={pose.position} quaternion={pose.rotation} visible={false}>
      <mesh position={[0, 0, -CONFIG.PHOTO_DEPTH / 2]}>
        <boxGeometry args={[CONFIG.PHOTO_WIDTH, CONFIG.PHOTO_HEIGHT, CONFIG.PHOTO_DEPTH]} />
        <meshStandardMaterial ref={backing} color="#18202c" roughness={0.55} metalness={0.15} transparent opacity={0} depthWrite={false} />
      </mesh>
      <Image ref={image} url={url} position={[0, 0, 0.006]} scale={[4, 3]} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </group>
  );
}

// 保留已显示照片的优先级，并在接近重叠之前渐隐，避免边界反复闪烁。
function PhotoVisibility({ framesRef }) {
  const { camera, size } = useThree();
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), view: new THREE.Vector3(), nextOrder: 0 }), []);
  useFrame((_, delta) => {
    camera.updateMatrixWorld();
    const candidates = [];
    for (const entry of framesRef.current) {
      if (!entry?.group || !entry.image?.material) continue;
      const root = entry.group;
      root.updateWorldMatrix(true, false);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      let valid = true;
      for (const x of [-CONFIG.PHOTO_WIDTH / 2, CONFIG.PHOTO_WIDTH / 2]) {
        for (const y of [-CONFIG.PHOTO_HEIGHT / 2, CONFIG.PHOTO_HEIGHT / 2]) {
          for (const z of [-CONFIG.PHOTO_DEPTH, 0.01]) {
            scratch.point.set(x, y, z).applyMatrix4(root.matrixWorld);
            scratch.view.copy(scratch.point).applyMatrix4(camera.matrixWorldInverse);
            if (scratch.view.z >= -camera.near) valid = false;
            scratch.point.project(camera);
            const px = (scratch.point.x + 1) * size.width / 2;
            const py = (1 - scratch.point.y) * size.height / 2;
            left = Math.min(left, px); right = Math.max(right, px);
            top = Math.min(top, py); bottom = Math.max(bottom, py);
          }
        }
      }
      const distance = camera.position.distanceTo(root.position);
      if (!valid || right < 0 || left > size.width || bottom < 0 || top > size.height || distance > 75) {
        root.visible = false;
        entry.selected = false;
        entry.opacity = 0;
        continue;
      }
      candidates.push({ entry, left, right, top, bottom, distance });
    }
    updatePhotoSelection(candidates, scratch, CONFIG.SCREEN_GAP_PX, delta);
    for (const { entry } of candidates) {
      entry.group.visible = entry.opacity > 0.005;
      entry.image.material.opacity = entry.opacity;
      entry.backing.opacity = entry.opacity;
    }
  }, -1);
  return null;
}

// 3. 终点烟花：一组柔和小光点，避免大球体下坠的观感。
function Fireworks({ progress, cameraPosition }) {
  const particles = useRef([]);
  const hasTriggered = useRef(false);
  const geometry = useRef();
  const data = useMemo(() => ({
    positions: new Float32Array(1200 * 3),
    colors: new Float32Array(1200 * 3),
  }), []);
  const glowTexture = useMemo(() => {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
        const offset = (y * size + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
        pixels[offset + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255);
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useEffect(() => {
    if (progress <= 0.95 || hasTriggered.current || !cameraPosition) return;
    hasTriggered.current = true;
    const result = [];
    for (let f = 0; f < 8; f++) {
      const center = cameraPosition.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        5 + Math.random() * 10,
        15 + Math.random() * 10
      ));
      const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.7);
      for (let i = 0; i < 150; i++) {
        const theta = Math.random() * Math.PI * 2;
        const cosPhi = Math.random() * 2 - 1;
        const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
        const speed = 3 + Math.random() * 5;
        result.push({
          position: center.clone(),
          velocity: new THREE.Vector3(sinPhi * Math.cos(theta), cosPhi, sinPhi * Math.sin(theta)).multiplyScalar(speed),
          color, life: 1, delay: f * 0.2, age: 0,
        });
      }
    }
    particles.current = result;
  }, [progress, cameraPosition]);

  useFrame((_, delta) => {
    if (!geometry.current || particles.current.length === 0) return;
    const dt = Math.min(delta, 0.05);
    particles.current.forEach((p, i) => {
      p.age += dt;
      if (p.age < p.delay) return;
      p.life = Math.max(0, p.life - dt * 0.5);
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 3 * dt;
      p.velocity.multiplyScalar(Math.exp(-1.2 * dt));
      const offset = i * 3;
      data.positions[offset] = p.position.x;
      data.positions[offset + 1] = p.position.y;
      data.positions[offset + 2] = p.position.z;
      data.colors[offset] = p.color.r * p.life;
      data.colors[offset + 1] = p.color.g * p.life;
      data.colors[offset + 2] = p.color.b * p.life;
    });
    geometry.current.attributes.position.needsUpdate = true;
    geometry.current.attributes.color.needsUpdate = true;
    if (particles.current.every((p) => p.life <= 0)) particles.current = [];
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowTexture} size={0.16} sizeAttenuation vertexColors
        transparent opacity={0.8} depthWrite={false} toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// 4. 轨道控制器
function RailController({
  backgroundRefs,
  explosionRef,
  riverCurve,
  riverLength,
  onProgressChange,
  onCameraUpdate,
}) {
  const { camera, gl } = useThree();
  const state = useRef({ progress: 0, velocity: 0 });
  const SENSITIVITY = 0.0025;
  const MAX_SPEED = 0.14;

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      const movement = e.deltaY + e.deltaX;
      state.current.velocity += movement * SENSITIVITY;
    };
    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [gl]);

  useFrame((_, delta) => {
    const s = state.current;
    if (s.velocity > MAX_SPEED) s.velocity = MAX_SPEED;
    if (s.velocity < -MAX_SPEED) s.velocity = -MAX_SPEED;
    s.velocity *= Math.exp(-5 * delta);
    s.progress += (s.velocity * delta * 60) / Math.max(riverLength, 1);

    if (s.progress < 0) {
      s.progress = 0;
      s.velocity = 0;
    }
    if (s.progress > 1) {
      s.progress = 1;
      s.velocity = 0;
    }

    const brightness = s.progress * s.progress;

    backgroundRefs.forEach((ref) => {
      if (ref.current) {
        ref.current.material.opacity = 0.2 + brightness * 1.2;
        ref.current.scale.setScalar(1 + s.progress * 0.3);
      }
    });

    if (explosionRef.current) {
      if (s.progress > 0.95) {
        const explosionProgress = (s.progress - 0.95) / 0.05;
        explosionRef.current.material.opacity = explosionProgress * 2.0;
        explosionRef.current.scale.setScalar(1 + explosionProgress * 0.5);
      } else {
        explosionRef.current.material.opacity = 0;
      }
    }

    const point = riverCurve.getPointAt(s.progress);
    const tangent = riverCurve.getTangentAt(s.progress).normalize();
    const targetPos = point.clone()
      .addScaledVector(tangent, -CONFIG.CAMERA_DISTANCE)
      .add(new THREE.Vector3(0, CONFIG.CAMERA_HEIGHT, 0));
    const alpha = 1 - Math.exp(-CONFIG.CAMERA_RESPONSE * delta);
    const targetLook = point.clone().addScaledVector(tangent, CONFIG.LOOK_AHEAD);
    if (!state.current.initialized) {
      camera.position.copy(targetPos);
      camera.userData.lookAtTarget = targetLook.clone();
      state.current.initialized = true;
    }
    camera.position.lerp(targetPos, alpha);
    camera.userData.lookAtTarget.lerp(targetLook, alpha);
    camera.lookAt(camera.userData.lookAtTarget);

    // UI 无需每帧触发 React 更新。
    state.current.uiElapsed = (state.current.uiElapsed || 0) + delta;
    if (state.current.uiElapsed >= 0.1) {
      state.current.uiElapsed = 0;
      onProgressChange?.(s.progress);
      onCameraUpdate?.(camera.position.clone());
    }
  }, -2);

  return null;
}

// 5. 音频控制器
function MusicPlayer({ url }) {
  const audioRef = useRef();
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch((e) => console.log("Autoplay blocked", e));
    }
  }, [url]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setMuted(audioRef.current.muted);
    }
  };

  if (!url) return null;

  return (
    <>
      <audio ref={audioRef} src={url} loop />
      <div
        onClick={toggleMute}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          color: "rgba(255,255,255,0.5)",
          cursor: "pointer",
          zIndex: 1000,
          fontSize: "20px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {muted ? "🔇" : "🔊"}
      </div>
    </>
  );
}

export default function App() {
  const [imageUrls, setImageUrls] = useState([]);
  const [musicUrl, setMusicUrl] = useState(null);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [cameraPos, setCameraPos] = useState(null);

  const framesRef = useRef([]);
  const cyanRef = useRef();
  const pinkRef = useRef();
  const purpleRef = useRef();
  const explosionRef = useRef();

  // 根据照片数量动态生成河流
  const riverData = useMemo(() => {
    if (imageUrls.length === 0) return null;
    return createRiverPath(imageUrls.length);
  }, [imageUrls.length]);

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    const newUrls = files.map((file) => URL.createObjectURL(file));
    setImageUrls(newUrls);
  };

  const handleMusicUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMusicUrl(URL.createObjectURL(file));
    }
  };

  if (imageUrls.length === 0) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#020010",
          color: "#fff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          fontFamily: "sans-serif",
          letterSpacing: "2px",
        }}
      >
        <h1 style={{ letterSpacing: "8px", fontWeight: "100" }}>2025 MEMORY</h1>

        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", opacity: 0.7 }}>
            Step 1: Background Music (Optional)
          </span>
          <label
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.1)",
              cursor: "pointer",
              fontSize: "12px",
              borderRadius: "4px",
            }}
          >
            {musicUrl ? "🎵 MUSIC READY" : "UPLOAD MP3"}
            <input
              type="file"
              accept="audio/*"
              onChange={handleMusicUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "12px", opacity: 0.7 }}>
            Step 2: Upload Photos & Start (30-60 photos best)
          </span>
          <label
            style={{
              padding: "12px 24px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: musicUrl ? "rgba(100,255,100,0.1)" : "transparent",
              cursor: "pointer",
              fontSize: "12px",
              transition: "all 0.3s",
            }}
          >
            SELECT PHOTOS
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>
    );
  }

  const endPosition = riverData.curve.getPointAt(0.95);

  return (
    <div style={{ height: "100vh", background: "black", width: "100vw" }}>
      <MusicPlayer url={musicUrl} />

      {/* 信息面板 */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          color: "rgba(255,255,255,0.6)",
          fontSize: "11px",
          fontFamily: "monospace",
          zIndex: 1000,
          background: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "4px",
        }}
      >
        <div>📸 Photos: {imageUrls.length}</div>
        <div>📏 River Length: {riverData.riverLength.toFixed(1)} units</div>
        <div>📍 Spacing: {riverData.spacing.toFixed(2)} units</div>
        <div>🌊 Wave Cycles: {riverData.waveFrequency.toFixed(1)}</div>
        <div>↔️ Amplitude: {riverData.waveAmplitude.toFixed(1)} units</div>
        <div>↕️ Height Range: {riverData.verticalRange.toFixed(1)} units</div>
      </div>

      <Canvas camera={{ fov: 50, near: 0.1, far: 1000 }}>
        <color attach="background" args={["#020010"]} />
        <ambientLight intensity={0.2} />
        <pointLight
          position={[0, 10, 0]}
          intensity={2}
          color="#fff"
          distance={50}
        />

        <Stars
          radius={200}
          depth={50}
          count={3000}
          factor={4}
          saturation={1}
          fade
        />

        <Sparkles
          ref={cyanRef}
          count={2000}
          scale={100}
          size={2}
          speed={0.3}
          opacity={0}
          color="#00ffff"
          mixColor="#00aaaa"
          mix={0.5}
        />
        <Sparkles
          ref={pinkRef}
          count={2000}
          scale={110}
          size={3}
          speed={0.4}
          opacity={0}
          color="#ff00ff"
          mixColor="#ffaaaa"
          mix={0.5}
        />
        <Sparkles
          ref={purpleRef}
          count={2000}
          scale={120}
          size={2}
          speed={0.2}
          opacity={0}
          color="#bd66ff"
          mixColor="#9900ff"
          mix={0.8}
        />

        <Sparkles
          ref={explosionRef}
          position={[endPosition.x, endPosition.y + 5, endPosition.z]}
          count={2000}
          scale={40}
          size={6}
          speed={4}
          opacity={0}
          color="#ffdd00"
          mixColor="#ffffff"
          mix={0.5}
          noise={0.5}
        />

        <RailController
          backgroundRefs={[cyanRef, pinkRef, purpleRef]}
          explosionRef={explosionRef}
          riverCurve={riverData.curve}
          riverLength={riverData.riverLength}
          onProgressChange={setJourneyProgress}
          onCameraUpdate={setCameraPos}
        />

        <Fireworks progress={journeyProgress} cameraPosition={cameraPos} />

        {imageUrls.map((url, index) => (
          <FilmFrame
            key={index}
            url={url}
            index={index}
            total={imageUrls.length}
            riverCurve={riverData.curve}
            framesRef={framesRef}
          />
        ))}

        <PhotoVisibility framesRef={framesRef} />

        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.85}
            mipmapBlur
            intensity={0.55}
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.2} />
          <Noise opacity={0.02} />
        </EffectComposer>
      </Canvas>

      <div
        style={{
          position: "fixed",
          bottom: "20px",
          width: "100%",
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: "10px",
          pointerEvents: "none",
          letterSpacing: "2px",
        }}
      >
        SCROLL TO THE END
      </div>
    </div>
  );
}

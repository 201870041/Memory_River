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

// 配置参数
const CONFIG = {
  PHOTOS_PER_100_UNITS: 49, // 每100单位长度放49张照片（可调整密度）
  MIN_PHOTO_SPACING: 2.0, // 最小照片间距
  CAMERA_DISTANCE: 8, // 相机距离
  CAMERA_SMOOTHNESS: 0.2, // 相机跟随平滑度 (0.1-0.3，越大越平滑)

  // 曲线动态参数
  BASE_WAVE_AMPLITUDE: 10, // 基础摆动幅度
  BASE_WAVE_FREQUENCY: 6, // 基础摆动频率（3个完整周期）
  MIN_WAVE_FREQUENCY: 3, // 最小频率（照片少时避免太密集）
  MAX_WAVE_FREQUENCY: 12, // 最大频率（照片多时增加变化）
};

// 1. 动态路径生成（根据照片数量调整）
const createRiverPath = (photoCount) => {
  const points = [];
  const pointCount = photoCount;

  // 根据照片数量计算河流长度（保持合理间距）
  const spacing = Math.max(
    CONFIG.MIN_PHOTO_SPACING,
    100 / CONFIG.PHOTOS_PER_100_UNITS
  );
  const riverLength = spacing * (photoCount - 1);

  // 动态调整曲线参数
  // 1. 摆动频率：照片越多，波动越多（但有上下限）
  const waveFrequency = Math.min(
    CONFIG.MAX_WAVE_FREQUENCY,
    Math.max(
      CONFIG.MIN_WAVE_FREQUENCY,
      CONFIG.BASE_WAVE_FREQUENCY * (photoCount / 49) // 以49张为基准
    )
  );

  // 2. 摆动幅度：根据河流长度动态调整，长河流可以有更大的摆动
  const waveAmplitude =
    CONFIG.BASE_WAVE_AMPLITUDE * Math.sqrt(riverLength / 100);

  // 3. 垂直高度差：根据河流长度调整，避免太陡或太平
  const verticalRange = Math.max(10, riverLength * 0.1); // 至少10单位高度差
  const verticalOffset = verticalRange / 2;

  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1);
    const z = t * riverLength - riverLength / 2;

    // X轴：简单的正弦波动
    const x = Math.sin(t * Math.PI * waveFrequency) * waveAmplitude;

    // Y轴：线性上升即可，简洁自然
    const y = t * verticalRange - verticalOffset;

    points.push(new THREE.Vector3(x, y, z));
  }

  return {
    curve: new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5),
    riverLength,
    spacing,
    waveFrequency,
    waveAmplitude,
    verticalRange,
  };
};

// 2. 照片组件
function FilmFrame({ url, index, total, riverCurve }) {
  const mesh = useRef();
  const t = index / (total - 1);
  const position = riverCurve.getPointAt(t);
  const tangent = riverCurve.getTangentAt(t);

  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.lookAt(position.clone().add(tangent));
    mesh.current.rotateX(-Math.PI / 1.9);
    mesh.current.rotateZ(Math.PI);
    // 完全移除浮动动画，照片固定在轨道上
    mesh.current.position.copy(position);
  });

  return (
    <group position={position} ref={mesh}>
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[4.4, 3.4]} />
        <meshStandardMaterial color="#000" roughness={0.1} metalness={0.9} />
      </mesh>
      <Image
        url={url}
        scale={[4, 3]}
        transparent
        opacity={0.95}
        toneMapped={false}
      />
    </group>
  );
}

// 3. 烟花系统
function Fireworks({ progress, cameraPosition }) {
  const [particles, setParticles] = useState([]);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (progress > 0.95 && !hasTriggered.current && cameraPosition) {
      hasTriggered.current = true;
      const newParticles = [];
      const fireworkCount = 8;

      for (let f = 0; f < fireworkCount; f++) {
        const distanceFromCamera = 15 + Math.random() * 10;
        const centerX = cameraPosition.x + (Math.random() - 0.5) * 20;
        const centerY = cameraPosition.y + Math.random() * 10 + 5;
        const centerZ = cameraPosition.z + distanceFromCamera;
        const color = new THREE.Color().setHSL(Math.random(), 1, 0.6);
        const launchDelay = f * 0.2;

        for (let i = 0; i < 150; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const speed = Math.random() * 10 + 5;

          newParticles.push({
            position: new THREE.Vector3(centerX, centerY, centerZ),
            velocity: new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta) * speed,
              Math.sin(phi) * Math.sin(theta) * speed,
              Math.cos(phi) * speed
            ),
            color: color,
            life: 1.0,
            size: Math.random() * 0.5 + 0.4,
            startTime: launchDelay,
            age: 0,
          });
        }
      }
      setParticles(newParticles);
    }
  }, [progress, cameraPosition]);

  useFrame((state, delta) => {
    if (particles.length === 0) return;

    setParticles((prevParticles) =>
      prevParticles
        .map((p) => {
          const newAge = p.age + delta;
          if (newAge < p.startTime) return { ...p, age: newAge };

          const newLife = p.life - delta * 0.5;
          if (newLife <= 0) return null;

          const newPos = p.position
            .clone()
            .add(p.velocity.clone().multiplyScalar(delta));
          const newVel = p.velocity.clone();
          newVel.y -= 9.8 * delta;
          newVel.multiplyScalar(0.98);

          return {
            ...p,
            position: newPos,
            velocity: newVel,
            life: newLife,
            age: newAge,
          };
        })
        .filter(Boolean)
    );
  });

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);

  return (
    <group>
      {particles.map((particle, index) => {
        if (particle.age < particle.startTime) return null;
        return (
          <mesh key={index} position={particle.position} scale={particle.size}>
            <primitive object={geometry} />
            <meshBasicMaterial
              color={particle.color}
              transparent
              opacity={particle.life}
            />
          </mesh>
        );
      })}
    </group>
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
  const SENSITIVITY = 0.00005;
  const MAX_SPEED = 0.005;

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
    s.velocity *= 0.9;
    s.progress += s.velocity * delta * 60;

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

    const currentT = s.progress;
    const point = riverCurve.getPointAt(currentT);
    const tangent = riverCurve.getTangentAt(currentT).normalize();
    const cameraOffset = tangent
      .clone()
      .multiplyScalar(-CONFIG.CAMERA_DISTANCE)
      .add(new THREE.Vector3(0, 3, 0));
    const targetPos = point.clone().add(cameraOffset);

    // 使用更高的平滑度来减少抖动
    camera.position.lerp(targetPos, CONFIG.CAMERA_SMOOTHNESS);

    // 相机朝向也使用插值平滑
    const lookAtTarget = camera.userData.lookAtTarget || point.clone();
    lookAtTarget.lerp(point, CONFIG.CAMERA_SMOOTHNESS);
    camera.userData.lookAtTarget = lookAtTarget;
    camera.lookAt(lookAtTarget);

    if (onProgressChange) onProgressChange(s.progress);
    if (onCameraUpdate) onCameraUpdate(camera.position);
  });

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
        <div>🌊 Wave Freq: {riverData.waveFrequency.toFixed(1)}</div>
        <div>↔️ Amplitude: {riverData.waveAmplitude.toFixed(1)} units</div>
        <div>↕️ Height Range: {riverData.verticalRange.toFixed(1)} units</div>
      </div>

      <Canvas camera={{ fov: 60, far: 1000 }}>
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
          />
        ))}

        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={0.1}
            mipmapBlur
            intensity={2.0}
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

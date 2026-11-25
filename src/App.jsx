import GalaxyFinale from "./GalaxyFinale.jsx";
import { CONFIG, createRiverPath, createPhotoPose } from "./photoRiver.js";
import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Image, Stars, Sparkles, Html, useProgress } from "@react-three/drei";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";

function FilmFrame({ url, index, total, riverCurve }) {
  const pose = useMemo(
    () => createPhotoPose(index, total, riverCurve),
    [index, total, riverCurve]
  );
  return (
    <group position={pose.position} quaternion={pose.rotation}>
      <mesh position={[0, 0, -CONFIG.PHOTO_DEPTH / 2]}>
        <boxGeometry args={[CONFIG.PHOTO_WIDTH, CONFIG.PHOTO_HEIGHT, CONFIG.PHOTO_DEPTH]} />
        <meshStandardMaterial color="#18202c" roughness={0.55} metalness={0.15} />
      </mesh>
      <Image url={url} position={[0, 0, 0.015]} scale={[4, 3]} transparent={false} opacity={1} toneMapped={false} />
    </group>
  );
}

// 4. 轨道控制器
function RailController({
  backgroundRefs,
  riverCurve,
  riverLength,
  journeyRef,
}) {
  const { camera, gl } = useThree();
  const assetsLoading = useProgress((state) => state.active);
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
    if (assetsLoading) return;
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
        ref.current.material.opacity = 0.12 + brightness * 0.2;
      }
    });

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

    journeyRef.current.progress = s.progress;
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
  const journeyRef = useRef({ progress: 0 });

  const cyanRef = useRef();
  const pinkRef = useRef();
  const purpleRef = useRef();

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

      <Canvas camera={{ fov: 50, near: 0.1, far: Math.max(1000, riverData.riverLength * 2) }}>
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

        <RailController
          backgroundRefs={[cyanRef, pinkRef, purpleRef]}
          riverCurve={riverData.curve}
          riverLength={riverData.riverLength}
          journeyRef={journeyRef}
        />

        <GalaxyFinale riverCurve={riverData.curve} photoCount={imageUrls.length} journeyRef={journeyRef} />

        <Suspense fallback={<Html center style={{ color: "white", whiteSpace: "nowrap" }}>Loading photos…</Html>}>
          {imageUrls.map((url, index) => (
            <FilmFrame
              key={index}
              url={url}
              index={index}
              total={imageUrls.length}
              riverCurve={riverData.curve}
            />
          ))}
        </Suspense>

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

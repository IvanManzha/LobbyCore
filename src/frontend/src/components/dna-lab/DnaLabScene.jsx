import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

import HelixDNA from "./HelixDNA";
import { buildHelix, computeMatchPositions } from "./utils/dnaGeometry";
import { isWebGLAvailable } from "./utils/isWebGLAvailable";

/**
 * DnaLabScene
 * - Owns <Canvas/>
 * - Exposes imperative methods: focusOnMatch(matchId), resetView()
 * - Keeps camera smooth focus (lerp)
 */
const DnaLabScene = forwardRef(function DnaLabScene(
  { profile, selectedGeneKey, selectedMatchId, selectedMatchDelta = 0, cinematicMode = "default", onSelectMatch, onHoverMatch },
  ref
) {
  const canWebGL = useMemo(() => isWebGLAvailable(), []);
  const controlsRef = useRef(null);

  const helix = useMemo(
    () =>
      buildHelix({
        turns: 9,
        radius: 2.05,
        height: 12.5,
        segmentsPerTurn: 38,
        rungEvery: 2,
      }),
    []
  );

  const matchPositions = useMemo(
    () => computeMatchPositions(profile.matches, helix),
    [profile.matches, helix]
  );

  // Focus system
  const defaultTarget = useMemo(
    () => new THREE.Vector3(0, helix.height * 0.55, 0),
    [helix.height]
  );

  const defaultCamPos = useMemo(
    () => new THREE.Vector3(0.0, helix.height * 0.55, 9.2),
    [helix.height]
  );

  const [focusTarget, setFocusTarget] = useState(defaultTarget);
  const [focusMode, setFocusMode] = useState("default"); // "default" | "match"

  const canvasRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focusOnMatch: (matchId) => {
      const p = matchPositions.byId[matchId]?.pos;
      if (!p) return;
      setFocusTarget(p.clone());
      setFocusMode("match");
    },
    resetView: () => {
      setFocusTarget(defaultTarget.clone());
      setFocusMode("default");
    },
    captureImage: () => {
      if (!canvasRef.current) return null;
      const gl = canvasRef.current.querySelector("canvas")?.getContext("webgl")
        || canvasRef.current.querySelector("canvas")?.getContext("webgl2");
      const canvas = canvasRef.current.querySelector("canvas");
      if (!canvas) return null;
      try {
        return canvas.toDataURL("image/png");
      } catch (e) {
        return null;
      }
    },
  }));

  if (!canWebGL) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
          opacity: 0.85,
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center", lineHeight: 1.4 }}>
          <b>WebGL is not available.</b>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            DNA Lab 3D requires WebGL. Try another browser/device.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={canvasRef} style={{ position: "relative", width: "100%", height: "100%" }}>
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      camera={{ position: defaultCamPos.toArray(), fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      onPointerMissed={() => {
        onHoverMatch?.(null);
      }}
    >
      <color attach="background" args={["#070812"]} />

      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={1.15} />
      <directionalLight position={[-6, -2, -6]} intensity={0.35} />

      <Stars radius={120} depth={40} count={1600} factor={2} saturation={0} fade speed={0.6} />

      <SceneRig
        controlsRef={controlsRef}
        focusTarget={focusTarget}
        focusMode={focusMode}
        defaultCamPos={defaultCamPos}
        cinematicMode={cinematicMode}
        matchPositions={matchPositions}
        helix={helix}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        zoomSpeed={0.9}
        enablePan={false}
        minDistance={4.6}
        maxDistance={18.0}
        makeDefault
      />

      <HelixDNA
        helix={helix}
        matches={profile.matches}
        matchPositions={matchPositions}
        selectedGeneKey={selectedGeneKey}
        selectedMatchId={selectedMatchId}
        selectedMatchDelta={selectedMatchDelta}
        onSelectMatch={onSelectMatch}
        onHoverMatch={onHoverMatch}
      />
    </Canvas>
    </div>
  );
});

function SceneRig({ controlsRef, focusTarget, focusMode, defaultCamPos, cinematicMode = "default", matchPositions = { ordered: [] }, helix }) {
  const desiredDistance = useMemo(() => 8.0, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const autoOrbitAngle = useRef(0);
  const focusPathIndex = useRef(0);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    let target = focusTarget.clone();

    if (cinematicMode === "autoOrbit") {
      autoOrbitAngle.current += delta * 0.15;
      const r = 2.5;
      target.set(
        Math.cos(autoOrbitAngle.current) * r,
        (helix?.height ?? 6 / 0.55) * 0.55,
        Math.sin(autoOrbitAngle.current) * r
      );
    }

    if (cinematicMode === "focusPath" && matchPositions.ordered?.length) {
      const ordered = matchPositions.ordered;
      focusPathIndex.current = (focusPathIndex.current + delta * 0.3) % ordered.length;
      const idx = Math.floor(focusPathIndex.current) % ordered.length;
      const pos = ordered[idx]?.pos;
      if (pos) target.copy(pos);
    }

    controls.target.lerp(target, 1 - Math.pow(0.001, delta));
    controls.update();

    if (focusMode === "match" || cinematicMode === "focusPath") {
      const cam = state.camera;
      const desiredCam = tmp
        .copy(controls.target)
        .add(new THREE.Vector3(0.0, 0.6, 1.0).normalize().multiplyScalar(desiredDistance));
      cam.position.lerp(desiredCam, 1 - Math.pow(0.001, delta));
    } else if (cinematicMode !== "autoOrbit") {
      const cam = state.camera;
      cam.position.lerp(defaultCamPos, 1 - Math.pow(0.001, delta));
    } else {
      const cam = state.camera;
      const desiredCam = tmp
        .copy(controls.target)
        .add(new THREE.Vector3(0, 0.4, 1).normalize().multiplyScalar(desiredDistance));
      cam.position.lerp(desiredCam, 1 - Math.pow(0.001, delta));
    }
  });

  return null;
}

export default DnaLabScene;

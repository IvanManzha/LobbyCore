import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeCylinderMatrix } from "./utils/dnaGeometry";
import { GENE_COLORS, NEUTRAL_NODE_COLOR } from "./utils/colors";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function MatchNode({
  position,
  baseScale,
  color,
  emissiveIntensity,
  hasDelta,
  deltaSign,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const pulse = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    meshRef.current.scale.setScalar(baseScale);
    materialRef.current.emissiveIntensity = emissiveIntensity;
    if (hasDelta && deltaSign !== 0) {
      pulse.current += delta * 3;
      const wave = Math.sin(pulse.current) * 0.12 * deltaSign;
      const s = baseScale * (1 + (deltaSign > 0 ? wave : -wave));
      meshRef.current.scale.setScalar(Math.max(0.5, s));
      materialRef.current.emissiveIntensity = emissiveIntensity + Math.abs(wave) * 2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[baseScale, baseScale, baseScale]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver?.();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut?.();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <sphereGeometry args={[0.11, 22, 22]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.25}
        metalness={0.2}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

export default function HelixDNA({
  helix,
  matches,
  matchPositions,
  selectedGeneKey,
  selectedMatchId,
  selectedMatchDelta = 0,
  onSelectMatch,
  onHoverMatch,
}) {
  const rungsRef = useRef(null);
  const beadsARef = useRef(null);
  const beadsBRef = useRef(null);

  const [hoveredMatchId, setHoveredMatchId] = useState(null);

  const aLinePoints = useMemo(() => helix.aPoints.map((p) => p.toArray()), [helix.aPoints]);
  const bLinePoints = useMemo(() => helix.bPoints.map((p) => p.toArray()), [helix.bPoints]);

  // Prepare instance matrices
  useLayoutEffect(() => {
    if (!rungsRef.current) return;
    const im = rungsRef.current;

    helix.rungs.forEach((r, i) => {
      const mat = makeCylinderMatrix(r.a, r.b, 0.020);
      im.setMatrixAt(i, mat);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [helix.rungs]);

  useLayoutEffect(() => {
    if (!beadsARef.current || !beadsBRef.current) return;
    const aMesh = beadsARef.current;
    const bMesh = beadsBRef.current;

    helix.rungs.forEach((r, i) => {
      const ma = new THREE.Matrix4().makeTranslation(r.a.x, r.a.y, r.a.z);
      const mb = new THREE.Matrix4().makeTranslation(r.b.x, r.b.y, r.b.z);
      aMesh.setMatrixAt(i, ma);
      bMesh.setMatrixAt(i, mb);
    });
    aMesh.instanceMatrix.needsUpdate = true;
    bMesh.instanceMatrix.needsUpdate = true;
  }, [helix.rungs]);

  const geneColor = useMemo(() => {
    const hex = GENE_COLORS[selectedGeneKey] || NEUTRAL_NODE_COLOR;
    return new THREE.Color(hex);
  }, [selectedGeneKey]);

  const rungMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      emissive: "#6c63ff",
      emissiveIntensity: 0.22,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.35,
    });
    return mat;
  }, []);

  const beadMatA = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#8c78ff",
      emissive: "#8c78ff",
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.20,
      transparent: true,
      opacity: 0.75,
    });
  }, []);

  const beadMatB = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#ff9b60",
      emissive: "#ff9b60",
      emissiveIntensity: 0.28,
      roughness: 0.30,
      metalness: 0.18,
      transparent: true,
      opacity: 0.70,
    });
  }, []);

  return (
    <group>
      {/* Strands */}
      <Line
        points={aLinePoints}
        color={"#8c78ff"}
        lineWidth={1.2}
        transparent
        opacity={0.55}
      />
      <Line
        points={bLinePoints}
        color={"#ff9b60"}
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />

      {/* Base-pairs (rungs) */}
      <instancedMesh
        ref={rungsRef}
        args={[null, null, helix.rungs.length]}
        material={rungMaterial}
      >
        <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
      </instancedMesh>

      {/* Backbone beads */}
      <instancedMesh ref={beadsARef} args={[null, null, helix.rungs.length]} material={beadMatA}>
        <sphereGeometry args={[0.055, 10, 10]} />
      </instancedMesh>

      <instancedMesh ref={beadsBRef} args={[null, null, helix.rungs.length]} material={beadMatB}>
        <sphereGeometry args={[0.055, 10, 10]} />
      </instancedMesh>

      {/* Match nodes */}
      {matches.map((m) => {
        const p = matchPositions.byId[m.id]?.pos;
        if (!p) return null;

        const isSelected = m.id === selectedMatchId;
        const isHovered = m.id === hoveredMatchId;
        const hasDelta = isSelected && selectedMatchDelta !== 0;

        // gene value controls glow/scale (0..100)
        const geneValRaw = selectedGeneKey ? m.geneValues[selectedGeneKey] : 50;
        const geneVal = clamp01(geneValRaw / 100);

        const baseScale = 1.0 + geneVal * 0.55;
        const scale = isSelected ? baseScale * 1.35 : isHovered ? baseScale * 1.12 : baseScale;

        const emissiveIntensity = 0.18 + geneVal * 1.05 + (isSelected ? 0.55 : 0);

        const color = geneColor.clone().lerp(new THREE.Color("#ffffff"), isSelected ? 0.15 : 0.0);

        return (
          <MatchNode
            key={m.id}
            position={p.toArray()}
            baseScale={scale}
            color={color}
            emissiveIntensity={emissiveIntensity}
            hasDelta={hasDelta}
            deltaSign={Math.sign(selectedMatchDelta)}
            onPointerOver={() => {
              setHoveredMatchId(m.id);
              onHoverMatch?.(m.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHoveredMatchId(null);
              onHoverMatch?.(null);
              document.body.style.cursor = "default";
            }}
            onClick={() => onSelectMatch?.(m.id)}
          />
        );
      })}
    </group>
  );
}

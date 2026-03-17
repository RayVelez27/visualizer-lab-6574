"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Text } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import * as d3 from "d3";
import {
  samples,
  Sample,
  COHORT_COLORS,
  BEP_COLORS,
  WAZ_COLORS,
} from "@/data/sampleData";

type ColorMode = "cohort" | "bep" | "waz" | "timepoint";
type ViewMode = "3d" | "2d";
type PCAxis = "pc1" | "pc2" | "pc3";

const PC_LABELS: Record<PCAxis, string> = {
  pc1: "PC1 (18.3%)",
  pc2: "PC2 (12.1%)",
  pc3: "PC3 (8.7%)",
};

const TP_COLORS: Record<number, string> = {
  1: "#06b6d4",
  2: "#8b5cf6",
  3: "#f59e0b",
};

function getColor(sample: Sample, mode: ColorMode): string {
  switch (mode) {
    case "cohort":
      return COHORT_COLORS[sample.cohort];
    case "bep":
      return sample.bep ? BEP_COLORS.Yes : BEP_COLORS.No;
    case "waz":
      return WAZ_COLORS[sample.wazCategory] || "#a3a3a3";
    case "timepoint":
      return TP_COLORS[sample.timepoint] || "#ffffff";
  }
}

function getGroupKey(sample: Sample, mode: ColorMode): string {
  switch (mode) {
    case "cohort":
      return sample.cohort;
    case "bep":
      return sample.bep ? "BEP Yes" : "BEP No";
    case "waz":
      return `WAZ ${sample.wazCategory}`;
    case "timepoint":
      return `TP ${sample.timepoint}`;
  }
}

function getLegend(
  mode: ColorMode
): { label: string; color: string }[] {
  switch (mode) {
    case "cohort":
      return Object.entries(COHORT_COLORS).map(([label, color]) => ({
        label,
        color,
      }));
    case "bep":
      return [
        { label: "BEP Yes", color: BEP_COLORS.Yes },
        { label: "BEP No", color: BEP_COLORS.No },
      ];
    case "waz":
      return Object.entries(WAZ_COLORS).map(([label, color]) => ({
        label: `WAZ ${label}`,
        color,
      }));
    case "timepoint":
      return Object.entries(TP_COLORS).map(([tp, color]) => ({
        label: `TP ${tp}`,
        color,
      }));
  }
}

// ── 3D Components ────────────────────────────────────────────────────

function DataPoint({
  position,
  color,
  size,
  sample,
  onHover,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  sample: Sample;
  onHover: (s: Sample | null, e?: ThreeEvent<PointerEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const scale = hovered ? size * 1.5 : size;
      meshRef.current.scale.lerp(
        new THREE.Vector3(scale, scale, scale),
        0.1
      );
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(sample, e);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.5 : 0.15}
        transparent
        opacity={hovered ? 1 : 0.8}
      />
    </mesh>
  );
}

function AxisLine({
  start,
  end,
  label,
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
}) {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: "#333" });
  const lineObj = new THREE.Line(geo, mat);
  return (
    <group>
      <primitive object={lineObj} />
      <Text
        position={end}
        fontSize={0.3}
        color="#555"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

function Scene({
  filteredSamples,
  colorMode,
  pointSize,
  autoRotate,
}: {
  filteredSamples: Sample[];
  colorMode: ColorMode;
  pointSize: number;
  opacity: number;
  autoRotate: boolean;
}) {
  const [hovered, setHovered] = useState<{
    sample: Sample;
    position?: [number, number, number];
  } | null>(null);

  const handleHover = useCallback(
    (s: Sample | null, e?: ThreeEvent<PointerEvent>) => {
      if (s && e) {
        setHovered({
          sample: s,
          position: [e.point.x, e.point.y, e.point.z],
        });
      } else {
        setHovered(null);
      }
    },
    []
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />
      <Stars
        radius={50}
        depth={50}
        count={1000}
        factor={2}
        saturation={0}
        fade
        speed={0.5}
      />
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
      />

      <AxisLine
        start={[-8, 0, 0]}
        end={[8, 0, 0]}
        label="PC1 (18.3%)"
      />
      <AxisLine
        start={[0, -6, 0]}
        end={[0, 6, 0]}
        label="PC2 (12.1%)"
      />
      <AxisLine
        start={[0, 0, -6]}
        end={[0, 0, 6]}
        label="PC3 (8.7%)"
      />

      {filteredSamples.map((s) => (
        <DataPoint
          key={s.sampleId}
          position={[s.pc1 * 1.5, s.pc2 * 1.5, s.pc3 * 1.5]}
          color={getColor(s, colorMode)}
          size={pointSize}
          sample={s}
          onHover={handleHover}
        />
      ))}

      {hovered && hovered.position && (
        <Html position={hovered.position} distanceFactor={10}>
          <div
            className="pointer-events-none px-3 py-2 rounded-lg text-xs whitespace-nowrap"
            style={{
              background: "#1a1a2eee",
              border: "1px solid #2a2a3e",
              color: "#e4e4ef",
            }}
          >
            <div className="font-semibold">{hovered.sample.sampleId}</div>
            <div style={{ color: "#8888a4" }}>
              {hovered.sample.cohort} | TP {hovered.sample.timepoint}
              <br />
              BEP: {hovered.sample.bep ? "Yes" : "No"} | WAZ:{" "}
              {hovered.sample.wazM04.toFixed(2)}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}

// ── 2D Scatter with density contours + marginals ─────────────────────

function Scatter2D({
  filteredSamples,
  colorMode,
  xAxis,
  yAxis,
  showContours,
}: {
  filteredSamples: Sample[];
  colorMode: ColorMode;
  xAxis: PCAxis;
  yAxis: PCAxis;
  showContours: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    sample: Sample;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const marginalH = 48;
  const plotW = dims.width - margin.left - margin.right;
  const plotH = dims.height - margin.top - margin.bottom - marginalH;

  const xVals = useMemo(
    () => filteredSamples.map((s) => s[xAxis]),
    [filteredSamples, xAxis]
  );
  const yVals = useMemo(
    () => filteredSamples.map((s) => s[yAxis]),
    [filteredSamples, yAxis]
  );

  const xScale = useMemo(() => {
    const ext = d3.extent(xVals) as [number, number];
    const pad = (ext[1] - ext[0]) * 0.1 || 1;
    return d3
      .scaleLinear()
      .domain([ext[0] - pad, ext[1] + pad])
      .range([0, plotW]);
  }, [xVals, plotW]);

  const yScale = useMemo(() => {
    const ext = d3.extent(yVals) as [number, number];
    const pad = (ext[1] - ext[0]) * 0.1 || 1;
    return d3
      .scaleLinear()
      .domain([ext[0] - pad, ext[1] + pad])
      .range([plotH, 0]);
  }, [yVals, plotH]);

  // Group samples by color mode for contours and marginals
  const groups = useMemo(() => {
    const map: Record<
      string,
      { color: string; samples: Sample[] }
    > = {};
    for (const s of filteredSamples) {
      const key = getGroupKey(s, colorMode);
      if (!map[key]) map[key] = { color: getColor(s, colorMode), samples: [] };
      map[key].samples.push(s);
    }
    return map;
  }, [filteredSamples, colorMode]);

  // Contour paths per group
  const contourPaths = useMemo(() => {
    if (!showContours || plotW <= 0 || plotH <= 0) return [];

    const result: { path: string; color: string; opacity: number }[] = [];

    for (const [, group] of Object.entries(groups)) {
      if (group.samples.length < 5) continue;

      const xData = group.samples.map((s) => s[xAxis]);
      const yData = group.samples.map((s) => s[yAxis]);

      // Simple 2D KDE on a grid
      const gridSize = 40;
      const xDomain = xScale.domain();
      const yDomain = yScale.domain();
      const xStep = (xDomain[1] - xDomain[0]) / gridSize;
      const yStep = (yDomain[1] - yDomain[0]) / gridSize;

      // Bandwidth (Silverman's rule approx)
      const n = xData.length;
      const xStd = d3.deviation(xData) || 1;
      const yStd = d3.deviation(yData) || 1;
      const bwX = 1.06 * xStd * Math.pow(n, -0.2);
      const bwY = 1.06 * yStd * Math.pow(n, -0.2);

      const grid: number[] = new Array(gridSize * gridSize).fill(0);

      for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
          const cx = xDomain[0] + (gx + 0.5) * xStep;
          const cy = yDomain[0] + (gy + 0.5) * yStep;
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const dx = (cx - xData[i]) / bwX;
            const dy = (cy - yData[i]) / bwY;
            sum += Math.exp(-0.5 * (dx * dx + dy * dy));
          }
          grid[gy * gridSize + gx] = sum / (n * 2 * Math.PI * bwX * bwY);
        }
      }

      const maxDensity = Math.max(...grid);
      if (maxDensity <= 0) continue;

      const contours = d3
        .contours()
        .size([gridSize, gridSize])
        .thresholds([maxDensity * 0.2, maxDensity * 0.5, maxDensity * 0.8]);

      const contourData = contours(grid);

      const projection = d3.geoTransform({
        point: function (x, y) {
          this.stream.point(
            xScale(xDomain[0] + (x + 0.5) * xStep),
            yScale(yDomain[0] + (y + 0.5) * yStep)
          );
        },
      });
      const pathGen = d3.geoPath().projection(projection);

      contourData.forEach((c, i) => {
        const p = pathGen(c);
        if (p) {
          result.push({
            path: p,
            color: group.color,
            opacity: 0.12 + i * 0.08,
          });
        }
      });
    }

    return result;
  }, [groups, xAxis, yAxis, xScale, yScale, showContours, plotW, plotH]);

  // Marginal density curves per group
  const marginalCurves = useMemo(() => {
    if (plotW <= 0) return { x: [] as any[], y: [] as any[] };

    const xCurves: {
      color: string;
      points: string;
    }[] = [];
    const yCurves: {
      color: string;
      points: string;
    }[] = [];

    for (const [, group] of Object.entries(groups)) {
      if (group.samples.length < 3) continue;

      // X marginal
      const xData = group.samples.map((s) => s[xAxis]);
      const xStd = d3.deviation(xData) || 1;
      const bw = 1.06 * xStd * Math.pow(xData.length, -0.2);
      const steps = 60;
      const xDomain = xScale.domain();
      const xStep = (xDomain[1] - xDomain[0]) / steps;

      const xDensity: [number, number][] = [];
      let xMax = 0;
      for (let i = 0; i <= steps; i++) {
        const cx = xDomain[0] + i * xStep;
        let sum = 0;
        for (const v of xData) {
          const d = (cx - v) / bw;
          sum += Math.exp(-0.5 * d * d);
        }
        const density = sum / (xData.length * bw * Math.sqrt(2 * Math.PI));
        xDensity.push([cx, density]);
        xMax = Math.max(xMax, density);
      }

      if (xMax > 0) {
        const pts = xDensity
          .map(
            ([v, d]) =>
              `${xScale(v)},${marginalH - (d / xMax) * (marginalH - 4)}`
          )
          .join(" ");
        xCurves.push({
          color: group.color,
          points: `${xScale(xDensity[0][0])},${marginalH} ${pts} ${xScale(xDensity[xDensity.length - 1][0])},${marginalH}`,
        });
      }

      // Y marginal
      const yData = group.samples.map((s) => s[yAxis]);
      const yStdD = d3.deviation(yData) || 1;
      const bwY = 1.06 * yStdD * Math.pow(yData.length, -0.2);
      const yDomain = yScale.domain();
      const yStepSize = (yDomain[1] - yDomain[0]) / steps;

      const yDensity: [number, number][] = [];
      let yMax = 0;
      for (let i = 0; i <= steps; i++) {
        const cy = yDomain[0] + i * yStepSize;
        let sum = 0;
        for (const v of yData) {
          const d = (cy - v) / bwY;
          sum += Math.exp(-0.5 * d * d);
        }
        const density = sum / (yData.length * bwY * Math.sqrt(2 * Math.PI));
        yDensity.push([cy, density]);
        yMax = Math.max(yMax, density);
      }

      if (yMax > 0) {
        const pts = yDensity
          .map(
            ([v, d]) =>
              `${(d / yMax) * (marginalH - 4)},${yScale(v)}`
          )
          .join(" ");
        yCurves.push({
          color: group.color,
          points: `0,${yScale(yDensity[0][0])} ${pts} 0,${yScale(yDensity[yDensity.length - 1][0])}`,
        });
      }
    }

    return { x: xCurves, y: yCurves };
  }, [groups, xAxis, yAxis, xScale, yScale, plotW, plotH]);

  // Axis ticks
  const xTicks = useMemo(() => xScale.ticks(6), [xScale]);
  const yTicks = useMemo(() => yScale.ticks(6), [yScale]);

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      <svg width={dims.width} height={dims.height} style={{ background: "#0a0a0f" }}>
        {/* X marginal (top) */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {marginalCurves.x.map((c, i) => (
            <polygon
              key={`xm-${i}`}
              points={c.points}
              fill={c.color}
              opacity={0.25}
            />
          ))}
          <line
            x1={0}
            y1={marginalH}
            x2={plotW}
            y2={marginalH}
            stroke="#2a2a3e"
            strokeWidth={0.5}
          />
        </g>

        {/* Y marginal (left, drawn into the left margin area) */}
        <g transform={`translate(${margin.left - marginalH}, ${margin.top + marginalH})`}>
          {marginalCurves.y.map((c, i) => (
            <polygon
              key={`ym-${i}`}
              points={c.points}
              fill={c.color}
              opacity={0.25}
            />
          ))}
          <line
            x1={marginalH}
            y1={0}
            x2={marginalH}
            y2={plotH}
            stroke="#2a2a3e"
            strokeWidth={0.5}
          />
        </g>

        {/* Main plot area */}
        <g transform={`translate(${margin.left}, ${margin.top + marginalH})`}>
          {/* Grid lines */}
          {xTicks.map((t) => (
            <line
              key={`xg-${t}`}
              x1={xScale(t)}
              y1={0}
              x2={xScale(t)}
              y2={plotH}
              stroke="#2a2a3e"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`yg-${t}`}
              x1={0}
              y1={yScale(t)}
              x2={plotW}
              y2={yScale(t)}
              stroke="#2a2a3e"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          ))}

          {/* Zero lines */}
          {xScale.domain()[0] < 0 && xScale.domain()[1] > 0 && (
            <line
              x1={xScale(0)}
              y1={0}
              x2={xScale(0)}
              y2={plotH}
              stroke="#3a3a4e"
              strokeWidth={1}
            />
          )}
          {yScale.domain()[0] < 0 && yScale.domain()[1] > 0 && (
            <line
              x1={0}
              y1={yScale(0)}
              x2={plotW}
              y2={yScale(0)}
              stroke="#3a3a4e"
              strokeWidth={1}
            />
          )}

          {/* Contours */}
          {contourPaths.map((c, i) => (
            <path
              key={`contour-${i}`}
              d={c.path}
              fill={c.color}
              opacity={c.opacity}
              stroke={c.color}
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          ))}

          {/* Points */}
          {filteredSamples.map((s) => (
            <circle
              key={s.sampleId}
              cx={xScale(s[xAxis])}
              cy={yScale(s[yAxis])}
              r={4}
              fill={getColor(s, colorMode)}
              opacity={0.75}
              stroke="#0a0a0f"
              strokeWidth={0.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) =>
                setTooltip({ x: e.clientX, y: e.clientY, sample: s })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* X axis */}
          <line
            x1={0}
            y1={plotH}
            x2={plotW}
            y2={plotH}
            stroke="#2a2a3e"
          />
          {xTicks.map((t) => (
            <text
              key={`xt-${t}`}
              x={xScale(t)}
              y={plotH + 16}
              fill="#8888a4"
              fontSize={10}
              textAnchor="middle"
            >
              {t.toFixed(1)}
            </text>
          ))}
          <text
            x={plotW / 2}
            y={plotH + 38}
            fill="#8888a4"
            fontSize={12}
            textAnchor="middle"
            fontWeight={600}
          >
            {PC_LABELS[xAxis]}
          </text>

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="#2a2a3e" />
          {yTicks.map((t) => (
            <text
              key={`yt-${t}`}
              x={-8}
              y={yScale(t) + 3}
              fill="#8888a4"
              fontSize={10}
              textAnchor="end"
            >
              {t.toFixed(1)}
            </text>
          ))}
          <text
            x={0}
            y={-8}
            fill="#8888a4"
            fontSize={12}
            textAnchor="start"
            fontWeight={600}
          >
            {PC_LABELS[yAxis]}
          </text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none px-3 py-2 rounded-lg text-xs z-50"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: "#1a1a2eee",
            border: "1px solid #2a2a3e",
            color: "#e4e4ef",
          }}
        >
          <div className="font-semibold">{tooltip.sample.sampleId}</div>
          <div style={{ color: "#8888a4" }}>
            {tooltip.sample.cohort} | TP {tooltip.sample.timepoint}
            <br />
            BEP: {tooltip.sample.bep ? "Yes" : "No"} | WAZ:{" "}
            {tooltip.sample.wazM04.toFixed(2)}
            <br />
            {xAxis}: {tooltip.sample[xAxis].toFixed(2)} | {yAxis}:{" "}
            {tooltip.sample[yAxis].toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function OrdinationPage() {
  const [colorMode, setColorMode] = useState<ColorMode>("cohort");
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(
    new Set(["MISAME", "VITAL", "CHILD"])
  );
  const [selectedTimepoints, setSelectedTimepoints] = useState<Set<number>>(
    new Set([1, 2, 3])
  );
  const [pointSize, setPointSize] = useState(1);
  const [opacity, setOpacity] = useState(0.8);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [xAxis, setXAxis] = useState<PCAxis>("pc1");
  const [yAxis, setYAxis] = useState<PCAxis>("pc2");
  const [showContours, setShowContours] = useState(true);

  const filteredSamples = useMemo(
    () =>
      samples.filter(
        (s) =>
          selectedCohorts.has(s.cohort) && selectedTimepoints.has(s.timepoint)
      ),
    [selectedCohorts, selectedTimepoints]
  );

  const toggleCohort = (c: string) => {
    setSelectedCohorts((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  };
  const toggleTP = (tp: number) => {
    setSelectedTimepoints((prev) => {
      const n = new Set(prev);
      n.has(tp) ? n.delete(tp) : n.add(tp);
      return n;
    });
  };

  return (
    <div className="flex h-screen pt-16" style={{ background: "#0a0a0f" }}>
      {/* Sidebar */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-72 shrink-0 border-r border-white/5 p-5 overflow-y-auto"
        style={{ background: "#0d0d14" }}
      >
        <h2 className="text-lg font-bold text-white mb-6">Ordination</h2>

        {/* View toggle */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            View
          </label>
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
            {(["3d", "2d"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {mode === "3d" ? "3D" : "2D Scatter"}
              </button>
            ))}
          </div>
        </div>

        {/* Color by */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Color By
          </label>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value="cohort">Cohort</option>
            <option value="bep">BEP Status</option>
            <option value="waz">WAZ Category</option>
            <option value="timepoint">Timepoint</option>
          </select>
        </div>

        {/* 2D axis selectors */}
        <AnimatePresence>
          {viewMode === "2d" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
                  X Axis
                </label>
                <select
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value as PCAxis)}
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                >
                  {(["pc1", "pc2", "pc3"] as const).map((pc) => (
                    <option key={pc} value={pc}>
                      {PC_LABELS[pc]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
                  Y Axis
                </label>
                <select
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value as PCAxis)}
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                >
                  {(["pc1", "pc2", "pc3"] as const).map((pc) => (
                    <option key={pc} value={pc}>
                      {PC_LABELS[pc]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showContours}
                    onChange={(e) => setShowContours(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      showContours ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                        showContours ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="text-sm text-white/70">
                    Density Contours
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cohort filter */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Cohorts
          </label>
          {["MISAME", "VITAL", "CHILD"].map((c) => (
            <label
              key={c}
              className="flex items-center gap-2 mb-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedCohorts.has(c)}
                onChange={() => toggleCohort(c)}
                className="sr-only"
              />
              <span
                className="w-3.5 h-3.5 rounded border flex items-center justify-center"
                style={{
                  borderColor: COHORT_COLORS[c],
                  backgroundColor: selectedCohorts.has(c)
                    ? COHORT_COLORS[c]
                    : "transparent",
                }}
              >
                {selectedCohorts.has(c) && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-sm text-white/70">{c}</span>
            </label>
          ))}
        </div>

        {/* Timepoint filter */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Timepoints
          </label>
          {[1, 2, 3].map((tp) => (
            <label
              key={tp}
              className="flex items-center gap-2 mb-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTimepoints.has(tp)}
                onChange={() => toggleTP(tp)}
                className="sr-only"
              />
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  selectedTimepoints.has(tp)
                    ? "bg-cyan-500 border-cyan-500"
                    : "border-white/20"
                }`}
              >
                {selectedTimepoints.has(tp) && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-sm text-white/70">TP {tp}</span>
            </label>
          ))}
        </div>

        {/* 3D-only controls */}
        <AnimatePresence>
          {viewMode === "3d" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
                  Point Size: {pointSize.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="3"
                  step="0.1"
                  value={pointSize}
                  onChange={(e) => setPointSize(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      autoRotate ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                        autoRotate ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="text-sm text-white/70">Auto-rotate</span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Legend
          </label>
          {getLegend(colorMode).map((item) => (
            <div key={item.label} className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-white/60">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-white/20 mt-4">
          {filteredSamples.length} samples displayed
        </div>
      </motion.div>

      {/* Viz area */}
      {viewMode === "3d" ? (
        <div className="flex-1 relative">
          <Canvas camera={{ position: [12, 8, 12], fov: 50 }}>
            <Scene
              filteredSamples={filteredSamples}
              colorMode={colorMode}
              pointSize={pointSize}
              opacity={opacity}
              autoRotate={autoRotate}
            />
          </Canvas>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 px-5 py-2.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/5">
            <span className="text-xs text-cyan-400 font-medium">
              PC1: 18.3%
            </span>
            <span className="text-xs text-violet-400 font-medium">
              PC2: 12.1%
            </span>
            <span className="text-xs text-amber-400 font-medium">
              PC3: 8.7%
            </span>
          </div>
        </div>
      ) : (
        <Scatter2D
          filteredSamples={filteredSamples}
          colorMode={colorMode}
          xAxis={xAxis}
          yAxis={yAxis}
          showContours={showContours}
        />
      )}
    </div>
  );
}

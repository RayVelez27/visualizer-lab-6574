"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, LineChart, Line,
} from "recharts";
import * as d3 from "d3";
import {
  metabolites, shapFeatures, correlations, logRatios, samples,
  PLATFORM_COLORS, COHORT_COLORS,
} from "@/data/sampleData";

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#e4e4ef", fontSize: 12 },
  itemStyle: { color: "#e4e4ef" },
  labelStyle: { color: "#8888a4" },
};

const TABS = ["SHAP Explorer", "Correlation Heatmap", "Platform Comparison"] as const;
type Tab = typeof TABS[number];

// ── SHAP Explorer ─────────────────────────────────────────────────
function ShapExplorer({ search }: { search: string }) {
  const [featureType, setFeatureType] = useState<"growth" | "BEP">("growth");
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let f = shapFeatures.filter((s) => s.type === featureType);
    if (search) f = f.filter((s) => s.feature.toLowerCase().includes(search.toLowerCase()));
    return f.slice(0, 20).reverse();
  }, [featureType, search]);

  const detail = selectedFeature ? shapFeatures.find((f) => f.feature === selectedFeature) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 viz-card">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-sm font-semibold text-white">Feature Importance</h3>
          <div className="flex gap-1">
            {(["growth", "BEP"] as const).map((t) => (
              <button key={t} onClick={() => setFeatureType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${featureType === t ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/40"}`}>
                {t === "growth" ? "Growth (WAZ)" : "BEP"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={filtered} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#8888a4", fontSize: 10 }} axisLine={{ stroke: "#2a2a3e" }} />
            <YAxis type="category" dataKey="feature" tick={{ fill: "#8888a4", fontSize: 10 }} axisLine={{ stroke: "#2a2a3e" }} width={75} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]} cursor="pointer"
              onClick={(data: any) => setSelectedFeature(data?.feature)}>
              {filtered.map((entry, idx) => (
                <Cell key={idx} fill={PLATFORM_COLORS[entry.platform] || "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="viz-card">
        <h3 className="text-sm font-semibold text-white mb-4">Feature Detail</h3>
        {detail ? (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-bold text-white">{detail.feature}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[detail.platform] }} />
                <span className="text-xs text-white/50">{detail.platform}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <div className="text-xs text-white/40">Importance</div>
                <div className="text-lg font-bold text-white">{detail.importance.toFixed(4)}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <div className="text-xs text-white/40">Direction</div>
                <div className={`text-lg font-bold ${detail.direction === "positive" ? "text-green-400" : "text-red-400"}`}>
                  {detail.direction === "positive" ? "+" : "-"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <div className="text-xs text-white/40">Type</div>
                <div className="text-sm font-medium text-white">{detail.type}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <div className="text-xs text-white/40">Rank</div>
                <div className="text-lg font-bold text-white">
                  #{shapFeatures.findIndex((f) => f.feature === detail.feature) + 1}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/30">Click a bar to see details</p>
        )}
      </div>
    </div>
  );
}

// ── Correlation Heatmap ───────────────────────────────────────────
function CorrelationHeatmap({ search }: { search: string }) {
  const [cohort, setCohort] = useState("MISAME");
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null);

  const filtered = useMemo(() => {
    let c = correlations.filter((c) => c.cohort === cohort);
    if (search) c = c.filter((c) => c.metabolite.toLowerCase().includes(search.toLowerCase()) || c.protein.toLowerCase().includes(search.toLowerCase()));
    return c;
  }, [cohort, search]);

  const metaboliteNames = useMemo(() => [...new Set(filtered.map((c) => c.metabolite))], [filtered]);
  const proteinNames = useMemo(() => [...new Set(filtered.map((c) => c.protein))], [filtered]);

  const colorScale = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);
  const cellSize = 28;

  return (
    <div className="viz-card">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-sm font-semibold text-white">Metabolite–Protein Correlations</h3>
        <div className="flex gap-1">
          {["MISAME", "VITAL"].map((c) => (
            <button key={c} onClick={() => setCohort(c)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${cohort === c ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/40"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto max-h-[600px] relative" ref={heatmapRef}>
        <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${proteinNames.length}, ${cellSize}px)`, gap: 1 }}>
          {/* Header row */}
          <div />
          {proteinNames.map((p) => (
            <div key={p} className="text-[8px] text-white/40 overflow-hidden" style={{
              writingMode: "vertical-lr", transform: "rotate(180deg)",
              height: 80, display: "flex", alignItems: "center",
            }}>
              {p}
            </div>
          ))}

          {/* Data rows */}
          {metaboliteNames.map((met) => (
            <>
              <div key={`label-${met}`} className="text-[9px] text-white/50 flex items-center pr-2 truncate">{met}</div>
              {proteinNames.map((prot) => {
                const cell = filtered.find((c) => c.metabolite === met && c.protein === prot);
                if (!cell) return <div key={`${met}-${prot}`} style={{ width: cellSize, height: cellSize, background: "#1a1a2e" }} />;
                return (
                  <div
                    key={`${met}-${prot}`}
                    style={{
                      width: cellSize, height: cellSize,
                      backgroundColor: colorScale(cell.rho),
                      opacity: cell.significant ? 1 : 0.25,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, data: cell })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </>
          ))}
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[10px] text-white/40">-1</span>
          <div className="h-3 flex-1 rounded" style={{ background: "linear-gradient(to right, #2166ac, #f7f7f7, #b2182b)" }} />
          <span className="text-[10px] text-white/40">+1</span>
          <span className="text-[10px] text-white/30 ml-4">Dimmed = p &gt; 0.05</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed pointer-events-none px-3 py-2 rounded-lg text-xs z-50"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10, background: "#1a1a2eee", border: "1px solid #2a2a3e", color: "#e4e4ef" }}>
          <div className="font-semibold">{tooltip.data.metabolite} × {tooltip.data.protein}</div>
          <div style={{ color: "#8888a4" }}>
            ρ = {tooltip.data.rho.toFixed(3)} | p = {tooltip.data.pValue.toFixed(4)}
            {tooltip.data.significant && <span className="text-cyan-400 ml-1">*</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Comparison ───────────────────────────────────────────
function PlatformComparison({ search }: { search: string }) {
  const platforms = Object.keys(PLATFORM_COLORS).filter((p) => p !== "Proteomics");
  const [platformA, setPlatformA] = useState(platforms[0]);
  const [platformB, setPlatformB] = useState(platforms[1]);

  const scatterData = useMemo(() => {
    const bySubject: Record<string, { cohort: string; a: number[]; b: number[] }> = {};
    for (const lr of logRatios) {
      if (!bySubject[lr.sampleId]) bySubject[lr.sampleId] = { cohort: lr.cohort, a: [], b: [] };
      if (lr.platform === platformA) bySubject[lr.sampleId].a.push(lr.logRatio);
      if (lr.platform === platformB) bySubject[lr.sampleId].b.push(lr.logRatio);
    }
    return Object.entries(bySubject)
      .filter(([, v]) => v.a.length > 0 && v.b.length > 0)
      .map(([id, v]) => ({
        x: v.a.reduce((a, b) => a + b, 0) / v.a.length,
        y: v.b.reduce((a, b) => a + b, 0) / v.b.length,
        cohort: v.cohort,
      }));
  }, [platformA, platformB]);

  // Calculate R²
  const r2 = useMemo(() => {
    const n = scatterData.length;
    if (n < 3) return 0;
    const mx = scatterData.reduce((a, d) => a + d.x, 0) / n;
    const my = scatterData.reduce((a, d) => a + d.y, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (const d of scatterData) { num += (d.x - mx) * (d.y - my); dx += (d.x - mx) ** 2; dy += (d.y - my) ** 2; }
    const r = num / (Math.sqrt(dx) * Math.sqrt(dy));
    return r * r;
  }, [scatterData]);

  const byCohort = useMemo(() => {
    const groups: Record<string, typeof scatterData> = {};
    for (const d of scatterData) {
      if (!groups[d.cohort]) groups[d.cohort] = [];
      groups[d.cohort].push(d);
    }
    return groups;
  }, [scatterData]);

  return (
    <div className="viz-card">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h3 className="text-sm font-semibold text-white">Cross-Platform Comparison</h3>
        <div className="flex items-center gap-2">
          <select value={platformA} onChange={(e) => setPlatformA(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none">
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="text-white/30 text-xs">vs</span>
          <select value={platformB} onChange={(e) => setPlatformB(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none">
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="stat-badge">R² = {r2.toFixed(3)}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={450}>
        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
          <XAxis type="number" dataKey="x" name={platformA}
            tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }}
            label={{ value: platformA, position: "insideBottom", offset: -10, fill: PLATFORM_COLORS[platformA], fontSize: 12 }} />
          <YAxis type="number" dataKey="y" name={platformB}
            tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }}
            label={{ value: platformB, angle: -90, position: "insideLeft", fill: PLATFORM_COLORS[platformB], fontSize: 12 }} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(byCohort).map(([cohort, data]) => (
            <Scatter key={cohort} name={cohort} data={data} fill={COHORT_COLORS[cohort]} opacity={0.7} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("SHAP Explorer");
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-6 lg:px-8" style={{ background: "#0a0a0f" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl md:text-3xl font-bold mb-1 gradient-text inline-block">Multi-Omics Explorer</h1>
        <p className="text-sm mb-6" style={{ color: "#8888a4" }}>SHAP features, correlations, and cross-platform analysis</p>
      </motion.div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metabolites..."
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none placeholder:text-white/20 w-56 focus:border-cyan-500/30"
          />
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          {activeTab === "SHAP Explorer" && <ShapExplorer search={search} />}
          {activeTab === "Correlation Heatmap" && <CorrelationHeatmap search={search} />}
          {activeTab === "Platform Comparison" && <PlatformComparison search={search} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Play, Pause, SkipBack } from "lucide-react";
import { samples, logRatios, COHORT_COLORS, PLATFORM_COLORS, BEP_COLORS } from "@/data/sampleData";

const MISAME_TPS = [
  { tp: 1, label: "14-21 Days" },
  { tp: 2, label: "1-2 Months" },
  { tp: 3, label: "3-4 Months" },
];

const VITAL_TPS = [
  { tp: 1, label: "40 Days" },
  { tp: 2, label: "56 Days" },
];

const PLATFORMS = ["Micronutrients", "Biocrates", "HMO", "Untargeted"];

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#e4e4ef", fontSize: 12 },
  itemStyle: { color: "#e4e4ef" },
  labelStyle: { color: "#8888a4" },
};

export default function TimelinePage() {
  const [currentTP, setCurrentTP] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentTP((prev) => {
        if (prev >= 3) { setPlaying(false); return 3; }
        return prev + 1;
      });
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed]);

  const misameScatter = useMemo(() => {
    const filtered = samples.filter((s) => s.cohort === "MISAME" && s.timepoint === currentTP);
    return {
      yes: filtered.filter((s) => s.bep).map((s) => ({ x: s.pc1, y: s.pc2, id: s.sampleId })),
      no: filtered.filter((s) => !s.bep).map((s) => ({ x: s.pc1, y: s.pc2, id: s.sampleId })),
    };
  }, [currentTP]);

  const vitalTP = Math.min(currentTP, 2);
  const vitalScatter = useMemo(() => {
    const filtered = samples.filter((s) => s.cohort === "VITAL" && s.timepoint === vitalTP);
    return {
      yes: filtered.filter((s) => s.bep).map((s) => ({ x: s.pc1, y: s.pc2, id: s.sampleId })),
      no: filtered.filter((s) => !s.bep).map((s) => ({ x: s.pc1, y: s.pc2, id: s.sampleId })),
    };
  }, [vitalTP]);

  // Log-ratio trajectories
  const trajectoryData = useMemo(() => {
    const result: Record<string, { tp: number; label: string; bepYes: number; bepNo: number }[]> = {};
    for (const platform of PLATFORMS) {
      const platformData = logRatios.filter((lr) => lr.platform === platform && lr.cohort === "MISAME");
      const byTP: Record<number, { yes: number[]; no: number[] }> = {};
      for (const lr of platformData) {
        if (!byTP[lr.timepoint]) byTP[lr.timepoint] = { yes: [], no: [] };
        (lr.bep ? byTP[lr.timepoint].yes : byTP[lr.timepoint].no).push(lr.logRatio);
      }
      result[platform] = MISAME_TPS.map(({ tp, label }) => ({
        tp,
        label,
        bepYes: byTP[tp]?.yes.length ? byTP[tp].yes.reduce((a, b) => a + b, 0) / byTP[tp].yes.length : 0,
        bepNo: byTP[tp]?.no.length ? byTP[tp].no.reduce((a, b) => a + b, 0) / byTP[tp].no.length : 0,
      }));
    }
    return result;
  }, []);

  // Stats for current timepoint
  const currentStats = useMemo(() => {
    const filtered = samples.filter((s) => s.cohort === "MISAME" && s.timepoint === currentTP);
    const bepCount = filtered.filter((s) => s.bep).length;
    return {
      count: filtered.length,
      meanPC1: filtered.length ? (filtered.reduce((a, s) => a + s.pc1, 0) / filtered.length).toFixed(2) : "—",
      meanPC2: filtered.length ? (filtered.reduce((a, s) => a + s.pc2, 0) / filtered.length).toFixed(2) : "—",
      bepRatio: filtered.length ? `${bepCount}/${filtered.length}` : "—",
    };
  }, [currentTP]);

  const currentLabel = MISAME_TPS.find((t) => t.tp === currentTP)?.label || "";

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-6 lg:px-8" style={{ background: "#0a0a0f" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl md:text-3xl font-bold mb-1 gradient-text inline-block">Lactation Timeline</h1>
        <p className="text-sm mb-6" style={{ color: "#8888a4" }}>Watch milk composition shift across timepoints</p>
      </motion.div>

      {/* Current timepoint indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="stat-badge text-base px-4 py-1.5">{currentLabel}</div>
        <div className="flex gap-4 text-xs" style={{ color: "#8888a4" }}>
          <span>Samples: <span className="text-white">{currentStats.count}</span></span>
          <span>Mean PC1: <span className="text-white">{currentStats.meanPC1}</span></span>
          <span>Mean PC2: <span className="text-white">{currentStats.meanPC2}</span></span>
          <span>BEP: <span className="text-white">{currentStats.bepRatio}</span></span>
        </div>
      </div>

      {/* Scatter plots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <motion.div className="viz-card" layout>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
            MISAME — PC1 vs PC2
            <span className="ml-2 stat-badge">{currentLabel}</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis type="number" dataKey="x" name="PC1" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} domain={[-8, 8]} />
              <YAxis type="number" dataKey="y" name="PC2" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} domain={[-6, 6]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Scatter name="BEP Yes" data={misameScatter.yes} fill={BEP_COLORS.Yes} opacity={0.8} />
              <Scatter name="BEP No" data={misameScatter.no} fill={BEP_COLORS.No} opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="viz-card" layout>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
            VITAL — PC1 vs PC2
            <span className="ml-2 stat-badge">{VITAL_TPS.find((t) => t.tp === vitalTP)?.label}</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis type="number" dataKey="x" name="PC1" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} domain={[-8, 8]} />
              <YAxis type="number" dataKey="y" name="PC2" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} domain={[-6, 6]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Scatter name="BEP Yes" data={vitalScatter.yes} fill={BEP_COLORS.Yes} opacity={0.8} />
              <Scatter name="BEP No" data={vitalScatter.no} fill={BEP_COLORS.No} opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Log-ratio trajectories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {PLATFORMS.map((platform) => (
          <motion.div key={platform} className="viz-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="text-xs font-semibold mb-2" style={{ color: PLATFORM_COLORS[platform] }}>{platform}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trajectoryData[platform]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                <XAxis dataKey="label" tick={{ fill: "#8888a4", fontSize: 9 }} axisLine={{ stroke: "#2a2a3e" }} />
                <YAxis tick={{ fill: "#8888a4", fontSize: 9 }} axisLine={{ stroke: "#2a2a3e" }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="bepYes" name="BEP Yes" stroke={BEP_COLORS.Yes} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="bepNo" name="BEP No" stroke={BEP_COLORS.No} strokeWidth={2} dot={{ r: 3 }} />
                <ReferenceLine x={currentLabel} stroke="#06b6d4" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        ))}
      </div>

      {/* Timeline controls */}
      <div className="viz-card max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setCurrentTP(1); setPlaying(false); }}
            className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <SkipBack className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: playing ? "#ef4444" : "#06b6d4" }}
          >
            {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
          </button>

          <div className="flex-1 timeline-scrubber">
            <input
              type="range" min="1" max="3" step="1" value={currentTP}
              onChange={(e) => setCurrentTP(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              {MISAME_TPS.map(({ tp, label }) => (
                <span key={tp} className={`text-[10px] ${tp === currentTP ? "text-cyan-400" : "text-white/30"}`}>{label}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${speed === s ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/40 hover:text-white/60"}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import {
  samples,
  metabolites,
  shapFeatures,
  logRatios,
  PLATFORM_COLORS,
  COHORT_COLORS,
  BEP_COLORS,
  WAZ_COLORS,
} from "@/data/sampleData";

const ALL_COHORTS = ["MISAME", "VITAL", "CHILD"] as const;

function Counter({ target, duration = 1.2 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / (duration * 1000), 1);
      setDisplay(Math.floor(progress * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <>{display.toLocaleString()}</>;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const KPI_ACCENTS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981"];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 8,
    color: "#e4e4ef",
    fontSize: 12,
  },
  itemStyle: { color: "#e4e4ef" },
  labelStyle: { color: "#8888a4" },
};

const timepointColors = ["#6366f1", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5", "#7c3aed"];

export default function DashboardPage() {
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(new Set(ALL_COHORTS));

  const toggleCohort = (cohort: string) => {
    setSelectedCohorts((prev) => {
      const next = new Set(prev);
      if (next.has(cohort)) {
        if (next.size > 1) next.delete(cohort);
      } else {
        next.add(cohort);
      }
      return next;
    });
  };

  const filteredSamples = useMemo(
    () => samples.filter((s) => selectedCohorts.has(s.cohort)),
    [selectedCohorts]
  );

  const filteredLogRatios = useMemo(
    () => logRatios.filter((lr) => selectedCohorts.has(lr.cohort)),
    [selectedCohorts]
  );

  const totalSamples = filteredSamples.length;
  const uniqueSubjects = new Set(filteredSamples.map((s) => s.subjectId)).size;
  const metaboliteCount = metabolites.length;
  const platformCount = 6;

  const kpis = [
    { label: "Total Samples", value: totalSamples },
    { label: "Unique Subjects", value: uniqueSubjects },
    { label: "Metabolites Tracked", value: metaboliteCount },
    { label: "Analytical Platforms", value: platformCount },
  ];

  const cohortTimepointData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const s of filteredSamples) {
      if (!map.has(s.cohort)) map.set(s.cohort, {});
      const row = map.get(s.cohort)!;
      row[s.timepointLabel] = (row[s.timepointLabel] || 0) + 1;
    }
    const allTimepoints = [...new Set(filteredSamples.map((s) => s.timepointLabel))];
    return Array.from(map.entries()).map(([cohort, tps]) => ({
      cohort,
      ...Object.fromEntries(allTimepoints.map((tp) => [tp, tps[tp] || 0])),
    }));
  }, [filteredSamples]);

  const allTimepointLabels = useMemo(
    () => [...new Set(filteredSamples.map((s) => s.timepointLabel))],
    [filteredSamples]
  );

  const bepScatterData = useMemo(() => {
    const misame = filteredSamples.filter((s) => s.cohort === "MISAME");
    return {
      yes: misame.filter((s) => s.bep).map((s) => ({ x: s.pc1, y: s.pc2 })),
      no: misame.filter((s) => !s.bep).map((s) => ({ x: s.pc1, y: s.pc2 })),
    };
  }, [filteredSamples]);

  const topShapGrowth = useMemo(
    () => shapFeatures.filter((f) => f.type === "growth").slice(0, 15).reverse(),
    []
  );

  const logRatioGrouped = useMemo(() => {
    const map = new Map<string, Record<string, { sum: number; count: number }>>();
    for (const lr of filteredLogRatios) {
      if (!map.has(lr.platform)) map.set(lr.platform, {});
      const row = map.get(lr.platform)!;
      if (!row[lr.cohort]) row[lr.cohort] = { sum: 0, count: 0 };
      row[lr.cohort].sum += lr.logRatio;
      row[lr.cohort].count += 1;
    }
    return Array.from(map.entries()).map(([platform, cohorts]) => ({
      platform,
      ...Object.fromEntries(
        Object.entries(cohorts).map(([c, v]) => [c, +(v.sum / v.count).toFixed(4)])
      ),
    }));
  }, [filteredLogRatios]);

  const wazDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filteredSamples) {
      counts[s.wazCategory] = (counts[s.wazCategory] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredSamples]);

  const loadingsData = useMemo(() => {
    return Object.entries(PLATFORM_COLORS).map(([platform, color]) => ({
      platform,
      color,
      data: metabolites
        .filter((m) => m.platform === platform)
        .map((m) => ({
          x: m.pc1Loading,
          y: m.pc2Loading,
          z: Math.abs(m.pc1Loading) * 800,
          name: m.name,
        })),
    }));
  }, []);

  return (
    <div className="min-h-screen p-4 pt-24 md:p-6 md:pt-24 lg:p-8 lg:pt-24" style={{ background: "#0a0a0f" }}>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-1 gradient-text inline-block">
          IMiC Dashboard
        </h1>
        <p className="text-sm mb-4" style={{ color: "#8888a4" }}>
          Multi-omics overview of mammary gland composition across cohorts
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8888a4" }}>
            Filter by Cohort
          </span>
          {ALL_COHORTS.map((cohort) => (
            <label key={cohort} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedCohorts.has(cohort)}
                onChange={() => toggleCohort(cohort)}
                className="sr-only"
              />
              <span
                className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
                style={{
                  borderColor: COHORT_COLORS[cohort],
                  backgroundColor: selectedCohorts.has(cohort) ? COHORT_COLORS[cohort] : "transparent",
                }}
              >
                {selectedCohorts.has(cohort) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium" style={{ color: "#e4e4ef" }}>{cohort}</span>
            </label>
          ))}
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} className="viz-card relative overflow-hidden" variants={cardVariants}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: KPI_ACCENTS[i] }} />
            <div className="pt-2">
              <div className="text-3xl md:text-4xl font-bold tabular-nums" style={{ color: "#e4e4ef" }}>
                <Counter target={kpi.value} />
              </div>
              <div className="text-xs mt-1 font-medium uppercase tracking-wider" style={{ color: "#8888a4" }}>
                {kpi.label}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            Samples by Cohort &amp; Timepoint
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cohortTimepointData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="cohort" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <YAxis tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8888a4" }} />
              {allTimepointLabels.map((tp, i) => (
                <Bar
                  key={tp}
                  dataKey={tp}
                  stackId="a"
                  fill={timepointColors[i % timepointColors.length]}
                  radius={i === allTimepointLabels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            PC1 vs PC2 by BEP Status
            <span className="ml-2 text-xs font-normal" style={{ color: "#8888a4" }}>(MISAME)</span>
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis type="number" dataKey="x" name="PC1" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <YAxis type="number" dataKey="y" name="PC2" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8888a4" }} />
              <Scatter name="BEP = Yes" data={bepScatterData.yes} fill={BEP_COLORS.Yes} opacity={0.7} />
              <Scatter name="BEP = No" data={bepScatterData.no} fill={BEP_COLORS.No} opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            Top SHAP Features (Growth)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topShapGrowth} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8888a4", fontSize: 10 }} axisLine={{ stroke: "#2a2a3e" }} />
              <YAxis type="category" dataKey="feature" tick={{ fill: "#8888a4", fontSize: 10 }} axisLine={{ stroke: "#2a2a3e" }} width={55} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {topShapGrowth.map((entry, idx) => (
                  <Cell key={`shap-${idx}`} fill={PLATFORM_COLORS[entry.platform] || "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            Log-Ratio Distribution by Platform
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={logRatioGrouped} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="platform" tick={{ fill: "#8888a4", fontSize: 10 }} axisLine={{ stroke: "#2a2a3e" }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8888a4" }} />
              {[...selectedCohorts].map((cohort) => (
                <Bar key={cohort} dataKey={cohort} fill={COHORT_COLORS[cohort]} radius={[4, 4, 0, 0]} opacity={0.85} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            WAZ Category Distribution
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={wazDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              >
                {wazDistribution.map((entry) => (
                  <Cell key={entry.name} fill={WAZ_COLORS[entry.name] || "#6366f1"} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8888a4" }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="viz-card" variants={cardVariants}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e4e4ef" }}>
            Feature Loadings — PC1
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis type="number" dataKey="x" name="PC1 Loading" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <YAxis type="number" dataKey="y" name="PC2 Loading" tick={{ fill: "#8888a4", fontSize: 11 }} axisLine={{ stroke: "#2a2a3e" }} />
              <ZAxis type="number" dataKey="z" range={[20, 200]} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, padding: "8px 12px", color: "#e4e4ef", fontSize: 12 }}>
                      <div className="font-semibold">{d.name}</div>
                      <div style={{ color: "#8888a4" }}>PC1: {d.x?.toFixed(3)} | PC2: {d.y?.toFixed(3)}</div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8888a4" }} />
              {loadingsData.map(({ platform, color, data }) => (
                <Scatter key={platform} name={platform} data={data} fill={color} opacity={0.75} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>
    </div>
  );
}

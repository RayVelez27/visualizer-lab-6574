"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import { correlations } from "@/data/sampleData";

const colorScale = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);
const CELL = 28;
const HIST_BINS = 30;

interface SelectedCell {
  metabolite: string;
  protein: string;
  rho: number;
  pValue: number;
  significant: boolean;
}

export default function HeatmapPage() {
  const [cohort, setCohort] = useState("MISAME");
  const otherCohort = cohort === "MISAME" ? "VITAL" : "MISAME";
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    metabolite: string;
    protein: string;
    rho: number;
    pValue: number;
    significant: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let c = correlations.filter((c) => c.cohort === cohort);
    if (search) {
      const q = search.toLowerCase();
      c = c.filter(
        (c) =>
          c.metabolite.toLowerCase().includes(q) ||
          c.protein.toLowerCase().includes(q)
      );
    }
    return c;
  }, [cohort, search]);

  const metaboliteNames = useMemo(
    () => [...new Set(filtered.map((c) => c.metabolite))],
    [filtered]
  );
  const proteinNames = useMemo(
    () => [...new Set(filtered.map((c) => c.protein))],
    [filtered]
  );

  const sigCount = useMemo(
    () => filtered.filter((c) => c.significant).length,
    [filtered]
  );

  // Histogram bins for the distribution strip
  const histData = useMemo(() => {
    const rhos = filtered.map((c) => c.rho);
    const bins = d3
      .bin<number, number>()
      .domain([-1, 1])
      .thresholds(HIST_BINS)(rhos);
    const maxCount = Math.max(...bins.map((b) => b.length));
    return bins.map((b) => ({
      x0: b.x0 ?? -1,
      x1: b.x1 ?? 1,
      count: b.length,
      height: maxCount > 0 ? b.length / maxCount : 0,
    }));
  }, [filtered]);

  // Row marginal stats: mean |rho| per metabolite
  const rowStats = useMemo(() => {
    const map: Record<string, { mean: number; maxAbs: number }> = {};
    for (const met of metaboliteNames) {
      const rows = filtered.filter((c) => c.metabolite === met);
      const absRhos = rows.map((c) => Math.abs(c.rho));
      const mean =
        absRhos.length > 0
          ? absRhos.reduce((a, b) => a + b, 0) / absRhos.length
          : 0;
      map[met] = { mean, maxAbs: Math.max(...absRhos, 0) };
    }
    return map;
  }, [filtered, metaboliteNames]);

  // Col marginal stats: mean |rho| per protein
  const colStats = useMemo(() => {
    const map: Record<string, { mean: number }> = {};
    for (const prot of proteinNames) {
      const cols = filtered.filter((c) => c.protein === prot);
      const absRhos = cols.map((c) => Math.abs(c.rho));
      const mean =
        absRhos.length > 0
          ? absRhos.reduce((a, b) => a + b, 0) / absRhos.length
          : 0;
      map[prot] = { mean };
    }
    return map;
  }, [filtered, proteinNames]);

  const maxRowMean = useMemo(
    () => Math.max(...Object.values(rowStats).map((r) => r.mean), 0.01),
    [rowStats]
  );
  const maxColMean = useMemo(
    () => Math.max(...Object.values(colStats).map((c) => c.mean), 0.01),
    [colStats]
  );

  // Cross-cohort comparison for selected cell
  const crossCohortRho = useMemo(() => {
    if (!selected) return null;
    const match = correlations.find(
      (c) =>
        c.cohort === otherCohort &&
        c.metabolite === selected.metabolite &&
        c.protein === selected.protein
    );
    return match ?? null;
  }, [selected, otherCohort]);

  // Where selected rho ranks among all rhos
  const selectedRank = useMemo(() => {
    if (!selected) return null;
    const sorted = [...filtered]
      .map((c) => Math.abs(c.rho))
      .sort((a, b) => b - a);
    const rank = sorted.findIndex((r) => r <= Math.abs(selected.rho)) + 1;
    return { rank, total: sorted.length };
  }, [selected, filtered]);

  return (
    <div
      className="min-h-screen pt-20 pb-8 px-4 md:px-6 lg:px-8"
      style={{ background: "#0a0a0f" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-1 gradient-text inline-block">
          Correlation Heatmap
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8888a4" }}>
          Metabolite–protein Spearman correlations with significance filtering
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        className="flex items-center gap-4 mb-4 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
          {["MISAME", "VITAL"].map((c) => (
            <button
              key={c}
              onClick={() => {
                setCohort(c);
                setSelected(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                cohort === c
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search metabolites or proteins..."
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none placeholder:text-white/20 w-64 focus:border-cyan-500/30"
        />

        <div className="flex gap-3 ml-auto text-xs text-white/40">
          <span>
            <span className="text-white/70 font-medium">
              {metaboliteNames.length}
            </span>{" "}
            metabolites
          </span>
          <span>
            <span className="text-white/70 font-medium">
              {proteinNames.length}
            </span>{" "}
            proteins
          </span>
          <span>
            <span className="text-cyan-400 font-medium">{sigCount}</span>{" "}
            significant pairs
          </span>
        </div>
      </motion.div>

      {/* Distribution strip */}
      <motion.div
        className="viz-card mb-4 py-3 px-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] font-medium text-white/60">
            Distribution of ρ values
          </span>
          <span className="text-[10px] text-white/30">
            {filtered.length} pairs
          </span>
        </div>
        <div className="flex items-end gap-[1px]" style={{ height: 48 }}>
          {histData.map((bin, i) => {
            const midpoint = ((bin.x0 + bin.x1) / 2);
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-150"
                style={{
                  height: `${Math.max(bin.height * 100, bin.count > 0 ? 4 : 0)}%`,
                  backgroundColor: colorScale(midpoint),
                  opacity: bin.count > 0 ? 0.8 : 0.1,
                }}
                title={`ρ ∈ [${bin.x0.toFixed(2)}, ${bin.x1.toFixed(2)}): ${bin.count}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-white/30">-1</span>
          <span className="text-[9px] text-white/30">0</span>
          <span className="text-[9px] text-white/30">+1</span>
        </div>
      </motion.div>

      {/* Main content: heatmap + detail panel */}
      <div className="flex gap-4">
        {/* Heatmap card */}
        <motion.div
          className="viz-card flex-1 min-w-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div
            className="overflow-auto max-h-[calc(100vh-320px)]"
            ref={scrollRef}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${proteinNames.length}, ${CELL}px) 40px`,
                gap: 1,
              }}
            >
              {/* Header row: empty corner + protein names + "Mean" label */}
              <div />
              {proteinNames.map((p) => (
                <div
                  key={p}
                  className="overflow-hidden cursor-pointer"
                  style={{
                    writingMode: "vertical-lr",
                    transform: "rotate(180deg)",
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 8,
                    color:
                      hoveredCol === p
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(255,255,255,0.4)",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={() => setHoveredCol(p)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  {p}
                </div>
              ))}
              <div
                className="text-[7px] text-white/30 flex items-end justify-center"
                style={{ height: 80 }}
              >
                |ρ̄|
              </div>

              {/* Column marginal bars (top) */}
              <div className="text-[8px] text-white/30 flex items-center pr-2">
                mean |ρ|
              </div>
              {proteinNames.map((prot) => {
                const stat = colStats[prot];
                const barH = stat ? Math.round((stat.mean / maxColMean) * CELL) : 0;
                return (
                  <div
                    key={`colbar-${prot}`}
                    className="flex items-end justify-center"
                    style={{ width: CELL, height: CELL }}
                  >
                    <div
                      className="rounded-t-sm transition-all duration-150"
                      style={{
                        width: CELL - 6,
                        height: barH,
                        backgroundColor:
                          hoveredCol === prot
                            ? "rgba(6,182,212,0.8)"
                            : "rgba(6,182,212,0.3)",
                      }}
                    />
                  </div>
                );
              })}
              <div />

              {/* Data rows */}
              {metaboliteNames.map((met) => {
                const stat = rowStats[met];
                const barW = stat ? Math.round((stat.mean / maxRowMean) * 36) : 0;
                return (
                  <div key={met} className="contents">
                    <div
                      className="flex items-center pr-2 truncate cursor-pointer"
                      style={{
                        fontSize: 9,
                        color:
                          hoveredRow === met
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(255,255,255,0.5)",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={() => setHoveredRow(met)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {met}
                    </div>
                    {proteinNames.map((prot) => {
                      const cell = filtered.find(
                        (c) => c.metabolite === met && c.protein === prot
                      );
                      const isHighlighted =
                        hoveredRow === met || hoveredCol === prot;
                      const isSelected =
                        selected?.metabolite === met &&
                        selected?.protein === prot;

                      if (!cell)
                        return (
                          <div
                            key={`${met}-${prot}`}
                            style={{
                              width: CELL,
                              height: CELL,
                              background: isHighlighted
                                ? "#1e1e32"
                                : "#1a1a2e",
                            }}
                          />
                        );
                      return (
                        <div
                          key={`${met}-${prot}`}
                          style={{
                            width: CELL,
                            height: CELL,
                            backgroundColor: colorScale(cell.rho),
                            opacity: cell.significant
                              ? isHighlighted
                                ? 1
                                : 0.85
                              : isHighlighted
                                ? 0.4
                                : 0.2,
                            cursor: "pointer",
                            outline: isSelected
                              ? "2px solid rgba(6,182,212,0.8)"
                              : "none",
                            outlineOffset: -1,
                            transition: "opacity 0.15s",
                          }}
                          onClick={() =>
                            setSelected({
                              metabolite: cell.metabolite,
                              protein: cell.protein,
                              rho: cell.rho,
                              pValue: cell.pValue,
                              significant: cell.significant,
                            })
                          }
                          onMouseEnter={(e) => {
                            setHoveredRow(met);
                            setHoveredCol(prot);
                            setTooltip({
                              x: e.clientX,
                              y: e.clientY,
                              metabolite: cell.metabolite,
                              protein: cell.protein,
                              rho: cell.rho,
                              pValue: cell.pValue,
                              significant: cell.significant,
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredRow(null);
                            setHoveredCol(null);
                            setTooltip(null);
                          }}
                        />
                      );
                    })}
                    {/* Row marginal bar */}
                    <div
                      className="flex items-center justify-start pl-1"
                      style={{ width: 40, height: CELL }}
                    >
                      <div
                        className="rounded-r-sm transition-all duration-150"
                        style={{
                          width: barW,
                          height: CELL - 6,
                          backgroundColor:
                            hoveredRow === met
                              ? "rgba(6,182,212,0.8)"
                              : "rgba(6,182,212,0.3)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] text-white/40">-1</span>
              <div
                className="h-3 flex-1 rounded"
                style={{
                  background:
                    "linear-gradient(to right, #2166ac, #f7f7f7, #b2182b)",
                }}
              />
              <span className="text-[10px] text-white/40">+1</span>
              <span className="text-[10px] text-white/30 ml-4">
                Dimmed = p &gt; 0.05
              </span>
              <span className="text-[10px] text-white/30 ml-2">
                Click cell for details
              </span>
            </div>
          </div>

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
              <div className="font-semibold">
                {tooltip.metabolite} × {tooltip.protein}
              </div>
              <div style={{ color: "#8888a4" }}>
                ρ = {tooltip.rho.toFixed(3)} | p ={" "}
                {tooltip.pValue.toFixed(4)}
                {tooltip.significant && (
                  <span className="text-cyan-400 ml-1">*</span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 280 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.3 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="viz-card h-full w-[280px]">
                {/* Close */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">
                    Cell Detail
                  </h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-white/30 hover:text-white/60 text-xs"
                  >
                    close
                  </button>
                </div>

                {/* Pair name */}
                <div className="mb-5">
                  <div className="text-[13px] font-bold text-white leading-tight">
                    {selected.metabolite}
                  </div>
                  <div className="text-[10px] text-white/30 my-0.5">×</div>
                  <div className="text-[13px] font-bold text-white leading-tight">
                    {selected.protein}
                  </div>
                </div>

                {/* Rho gauge */}
                <div className="mb-5">
                  <div className="text-[10px] text-white/40 mb-1.5">
                    Spearman ρ
                  </div>
                  <div className="relative h-6 bg-white/[0.04] rounded-full overflow-hidden">
                    {/* Center line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                    {/* Rho indicator */}
                    <div
                      className="absolute top-1 bottom-1 rounded-full transition-all duration-300"
                      style={{
                        left:
                          selected.rho >= 0
                            ? "50%"
                            : `${50 + (selected.rho / 1) * 50}%`,
                        width: `${Math.abs(selected.rho) * 50}%`,
                        backgroundColor: colorScale(selected.rho),
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-white/25">-1</span>
                    <span className="text-[13px] font-bold text-white">
                      {selected.rho > 0 ? "+" : ""}
                      {selected.rho.toFixed(3)}
                    </span>
                    <span className="text-[9px] text-white/25">+1</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[9px] text-white/35">p-value</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {selected.pValue < 0.001
                        ? selected.pValue.toExponential(1)
                        : selected.pValue.toFixed(4)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[9px] text-white/35">Significant</div>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        selected.significant
                          ? "text-cyan-400"
                          : "text-white/30"
                      }`}
                    >
                      {selected.significant ? "Yes (p<0.05)" : "No"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[9px] text-white/35">Direction</div>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        selected.rho > 0 ? "text-red-400" : "text-blue-400"
                      }`}
                    >
                      {selected.rho > 0 ? "Positive" : "Negative"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[9px] text-white/35">
                      |ρ| Rank
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {selectedRank
                        ? `${selectedRank.rank} / ${selectedRank.total}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Cross-cohort comparison */}
                <div className="border-t border-white/[0.06] pt-4">
                  <div className="text-[10px] text-white/40 mb-3">
                    Cross-cohort comparison
                  </div>
                  <div className="space-y-2">
                    {/* Current cohort */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-white/70">
                        {cohort}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-3 rounded-sm"
                          style={{ backgroundColor: colorScale(selected.rho) }}
                        />
                        <span className="text-[11px] font-bold text-white w-12 text-right">
                          {selected.rho > 0 ? "+" : ""}
                          {selected.rho.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    {/* Other cohort */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-white/70">
                        {otherCohort}
                      </span>
                      {crossCohortRho ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-3 rounded-sm"
                            style={{
                              backgroundColor: colorScale(crossCohortRho.rho),
                            }}
                          />
                          <span className="text-[11px] font-bold text-white w-12 text-right">
                            {crossCohortRho.rho > 0 ? "+" : ""}
                            {crossCohortRho.rho.toFixed(3)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/25">
                          no data
                        </span>
                      )}
                    </div>
                    {/* Delta */}
                    {crossCohortRho && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                        <span className="text-[10px] text-white/40">Δρ</span>
                        <span className="text-[11px] font-bold text-amber-400">
                          {Math.abs(selected.rho - crossCohortRho.rho).toFixed(
                            3
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

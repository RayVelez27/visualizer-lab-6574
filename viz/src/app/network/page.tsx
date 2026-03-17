"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import { networkData, PLATFORM_COLORS } from "@/data/sampleData";

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  platform: string;
  importance: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  correlation: number;
}

type ViewMode = "graph" | "chord";

// ── Chord Diagram ────────────────────────────────────────────────────
function ChordDiagram({
  nodes,
  edges,
  platformFilter,
}: {
  nodes: typeof networkData.nodes;
  edges: typeof networkData.edges;
  platformFilter: Set<string>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    html: string;
  } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const platforms = useMemo(
    () =>
      Object.keys(PLATFORM_COLORS).filter((p) => platformFilter.has(p)),
    [platformFilter]
  );

  // Build platform-to-platform matrix from edges
  const matrix = useMemo(() => {
    const nodeMap: Record<string, string> = {};
    for (const n of nodes) nodeMap[n.id] = n.platform;

    const idx: Record<string, number> = {};
    platforms.forEach((p, i) => (idx[p] = i));

    const m = platforms.map(() => platforms.map(() => 0));

    for (const e of edges) {
      const sp = nodeMap[e.source];
      const tp = nodeMap[e.target];
      if (sp && tp && idx[sp] !== undefined && idx[tp] !== undefined) {
        const w = Math.abs(e.correlation);
        m[idx[sp]][idx[tp]] += w;
        if (sp !== tp) m[idx[tp]][idx[sp]] += w;
      }
    }
    return m;
  }, [nodes, edges, platforms]);

  // Connection counts for tooltip
  const connectionCounts = useMemo(() => {
    const nodeMap: Record<string, string> = {};
    for (const n of nodes) nodeMap[n.id] = n.platform;

    const idx: Record<string, number> = {};
    platforms.forEach((p, i) => (idx[p] = i));

    const counts = platforms.map(() => platforms.map(() => 0));
    for (const e of edges) {
      const sp = nodeMap[e.source];
      const tp = nodeMap[e.target];
      if (sp && tp && idx[sp] !== undefined && idx[tp] !== undefined) {
        counts[idx[sp]][idx[tp]] += 1;
        if (sp !== tp) counts[idx[tp]][idx[sp]] += 1;
      }
    }
    return counts;
  }, [nodes, edges, platforms]);

  useEffect(() => {
    if (!svgRef.current || platforms.length < 2) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 500;
    const height = svgRef.current.clientHeight || 500;
    const outerRadius = Math.min(width, height) * 0.42;
    const innerRadius = outerRadius - 24;

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const chord = d3
      .chord()
      .padAngle(0.04)
      .sortSubgroups(d3.descending)(matrix);

    const arc = d3.arc<d3.ChordGroup>().innerRadius(innerRadius).outerRadius(outerRadius);

    const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>().radius(innerRadius);

    // Arcs (platform groups)
    g.append("g")
      .selectAll("path")
      .data(chord.groups)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d) => PLATFORM_COLORS[platforms[d.index]] || "#666")
      .attr("stroke", "#0a0a0f")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .attr("opacity", (d) =>
        hoveredIndex === null || hoveredIndex === d.index ? 0.9 : 0.2
      )
      .on("mouseover", function (event, d) {
        setHoveredIndex(d.index);
        const total = matrix[d.index].reduce((a, b) => a + b, 0);
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          html: `<strong>${platforms[d.index]}</strong><br/><span style="color:#8888a4">Total correlation weight: ${total.toFixed(1)}</span>`,
        });
      })
      .on("mouseout", () => {
        setHoveredIndex(null);
        setTooltip(null);
      });

    // Platform labels
    g.append("g")
      .selectAll("text")
      .data(chord.groups)
      .join("text")
      .each(function (d) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const r = outerRadius + 14;
        d3.select(this)
          .attr("x", r * Math.sin(angle))
          .attr("y", -r * Math.cos(angle))
          .attr("text-anchor", angle > Math.PI ? "end" : angle > 0 ? "start" : "middle")
          .attr("dominant-baseline", "central");
      })
      .text((d) => platforms[d.index])
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("fill", (d) => PLATFORM_COLORS[platforms[d.index]] || "#888");

    // Ribbons (connections between platforms)
    g.append("g")
      .selectAll("path")
      .data(chord)
      .join("path")
      .attr("d", ribbon as any)
      .attr("fill", (d) => PLATFORM_COLORS[platforms[d.source.index]] || "#666")
      .attr("stroke", "#0a0a0f")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .attr("opacity", (d) => {
        if (hoveredIndex === null) return 0.35;
        return d.source.index === hoveredIndex || d.target.index === hoveredIndex
          ? 0.7
          : 0.05;
      })
      .on("mouseover", function (event, d) {
        const si = d.source.index;
        const ti = d.target.index;
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          html: `<strong>${platforms[si]} ↔ ${platforms[ti]}</strong><br/><span style="color:#8888a4">${connectionCounts[si][ti]} edges | weight: ${matrix[si][ti].toFixed(1)}</span>`,
        });
      })
      .on("mouseout", () => {
        setTooltip(null);
      });

    return () => {
      svg.selectAll("*").remove();
    };
  }, [matrix, connectionCounts, platforms, hoveredIndex]);

  if (platforms.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        Select at least 2 platforms to see the chord diagram
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <svg ref={svgRef} width="100%" height="100%" style={{ background: "#0a0a0f" }} />
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
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [minCorr, setMinCorr] = useState(0.35);
  const [showLabels, setShowLabels] = useState(true);
  const [edgeColorBySign, setEdgeColorBySign] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<Set<string>>(
    new Set(Object.keys(PLATFORM_COLORS))
  );
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [viewMode, setViewMode] = useState<ViewMode>("graph");

  const togglePlatform = (p: string) => {
    setPlatformFilter((prev) => {
      const n = new Set(prev);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  };

  const filteredNodes = useMemo(
    () => networkData.nodes.filter((n) => platformFilter.has(n.platform)),
    [platformFilter]
  );

  const nodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredEdges = useMemo(
    () =>
      networkData.edges.filter(
        (e) =>
          Math.abs(e.correlation) >= minCorr &&
          nodeIds.has(e.source) &&
          nodeIds.has(e.target)
      ),
    [minCorr, nodeIds]
  );

  const stats = useMemo(() => {
    const n = filteredNodes.length;
    const e = filteredEdges.length;
    const avgDeg = n > 0 ? ((2 * e) / n).toFixed(1) : "0";
    const density = n > 1 ? ((2 * e) / (n * (n - 1))).toFixed(3) : "0";
    return { nodes: n, edges: e, avgDeg, density };
  }, [filteredNodes, filteredEdges]);

  // Platform connection summary for chord stats
  const chordStats = useMemo(() => {
    const nodeMap: Record<string, string> = {};
    for (const n of filteredNodes) nodeMap[n.id] = n.platform;

    const crossPlatform = filteredEdges.filter((e) => {
      const sp = nodeMap[e.source];
      const tp = nodeMap[e.target];
      return sp && tp && sp !== tp;
    });

    const withinPlatform = filteredEdges.length - crossPlatform.length;

    return {
      crossPlatform: crossPlatform.length,
      withinPlatform,
      platforms: [...platformFilter].length,
    };
  }, [filteredNodes, filteredEdges, platformFilter]);

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.parentElement?.getBoundingClientRect();
        if (rect) setDimensions({ width: rect.width, height: rect.height });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || viewMode !== "graph") return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const sizeScale = d3
      .scaleLinear()
      .domain([0, d3.max(filteredNodes, (d) => d.importance) || 1])
      .range([5, 18]);

    const nodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const links: SimLink[] = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      correlation: e.correlation,
    }));

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => sizeScale(d.importance) + 4)
      );

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.abs(d.correlation) * 3)
      .attr("stroke", (d) =>
        edgeColorBySign
          ? d.correlation > 0
            ? "#22c55e"
            : "#ef4444"
          : "#444"
      )
      .attr("stroke-opacity", 0.4);

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => sizeScale(d.importance))
      .attr("fill", (d) => PLATFORM_COLORS[d.platform] || "#666")
      .attr("stroke", "#0a0a0f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<any, SimNode>()
          .on("start", (event: any, d: SimNode) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: any, d: SimNode) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event: any, d: SimNode) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 9)
      .attr("fill", "#8888a4")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -sizeScale(d.importance) - 4)
      .attr("pointer-events", "none")
      .attr("opacity", showLabels ? 0.8 : 0);

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "network-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "#1a1a2eee")
      .style("border", "1px solid #2a2a3e")
      .style("border-radius", "8px")
      .style("padding", "8px 12px")
      .style("color", "#e4e4ef")
      .style("font-size", "12px")
      .style("z-index", "100")
      .style("opacity", "0");

    node
      .on("mouseover", function (event, d) {
        const neighbors = new Set<string>();
        links.forEach((l) => {
          const s =
            typeof l.source === "object"
              ? (l.source as SimNode).id
              : l.source;
          const t =
            typeof l.target === "object"
              ? (l.target as SimNode).id
              : l.target;
          if (s === d.id) neighbors.add(t as string);
          if (t === d.id) neighbors.add(s as string);
        });
        neighbors.add(d.id);
        node.attr("opacity", (n) => (neighbors.has(n.id) ? 1 : 0.1));
        link.attr("opacity", (l) => {
          const s =
            typeof l.source === "object"
              ? (l.source as SimNode).id
              : l.source;
          const t =
            typeof l.target === "object"
              ? (l.target as SimNode).id
              : l.target;
          return s === d.id || t === d.id ? 0.8 : 0.05;
        });
        label.attr("opacity", (n) => (neighbors.has(n.id) ? 1 : 0));
        const degree = neighbors.size - 1;
        tooltip
          .style("opacity", "1")
          .html(
            `<strong>${d.id}</strong><br/><span style="color:#8888a4">${d.platform} | Degree: ${degree}</span>`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY - 10 + "px");
      })
      .on("mouseout", () => {
        node.attr("opacity", 1);
        link.attr("opacity", 0.4);
        label.attr("opacity", showLabels ? 0.8 : 0);
        tooltip.style("opacity", "0");
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y - sizeScale(d.importance) - 4);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [filteredNodes, filteredEdges, dimensions, showLabels, edgeColorBySign, viewMode]);

  return (
    <div className="flex h-screen pt-16" style={{ background: "#0a0a0f" }}>
      {/* Sidebar */}
      <motion.div
        initial={{ x: -280, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-[280px] shrink-0 border-r border-white/5 p-5 overflow-y-auto"
        style={{ background: "#0d0d14" }}
      >
        <h2 className="text-lg font-bold text-white mb-6">
          Metabolite Network
        </h2>

        {/* View toggle */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            View
          </label>
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
            {(["graph", "chord"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {mode === "graph" ? "Force Graph" : "Chord"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Min Correlation: {minCorr.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={minCorr}
            onChange={(e) => setMinCorr(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">
            Platforms
          </label>
          {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
            <label
              key={platform}
              className="flex items-center gap-2 mb-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={platformFilter.has(platform)}
                onChange={() => togglePlatform(platform)}
                className="sr-only"
              />
              <span
                className="w-3.5 h-3.5 rounded border flex items-center justify-center"
                style={{
                  borderColor: color,
                  backgroundColor: platformFilter.has(platform)
                    ? color
                    : "transparent",
                }}
              >
                {platformFilter.has(platform) && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
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
              <span className="text-xs text-white/60">{platform}</span>
            </label>
          ))}
        </div>

        {/* Graph-only controls */}
        <AnimatePresence>
          {viewMode === "graph" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      showLabels ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                        showLabels ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="text-sm text-white/70">Show Labels</span>
                </label>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={edgeColorBySign}
                    onChange={(e) => setEdgeColorBySign(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      edgeColorBySign ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                        edgeColorBySign ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="text-sm text-white/70">
                    Color Edges by Sign
                  </span>
                </label>
              </div>

              {edgeColorBySign && (
                <div className="mb-4 text-xs text-white/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-green-500" /> Positive
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-red-500" /> Negative
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chord explanation */}
        <AnimatePresence>
          {viewMode === "chord" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-lg bg-white/[0.03] text-xs text-white/40 leading-relaxed">
                <p className="mb-2 text-white/60 font-medium">How to read</p>
                <p>
                  Arc size shows each platform&apos;s total correlation weight.
                  Ribbons connect platforms — thicker ribbons mean more or
                  stronger correlations between those two platforms.
                </p>
                <p className="mt-2">Hover arcs or ribbons for details.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Viz area */}
      <div className="flex-1 flex flex-col">
        {viewMode === "graph" ? (
          <div className="flex-1 relative">
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ background: "#0a0a0f" }}
            />
          </div>
        ) : (
          <ChordDiagram
            nodes={filteredNodes}
            edges={filteredEdges}
            platformFilter={platformFilter}
          />
        )}

        {/* Stats bar */}
        <div
          className="h-12 border-t border-white/5 flex items-center justify-center gap-8 px-6"
          style={{ background: "#0d0d14" }}
        >
          {viewMode === "graph" ? (
            <>
              <span className="text-xs text-white/40">
                Nodes:{" "}
                <span className="text-white/70 font-medium">{stats.nodes}</span>
              </span>
              <span className="text-xs text-white/40">
                Edges:{" "}
                <span className="text-white/70 font-medium">{stats.edges}</span>
              </span>
              <span className="text-xs text-white/40">
                Avg Degree:{" "}
                <span className="text-white/70 font-medium">
                  {stats.avgDeg}
                </span>
              </span>
              <span className="text-xs text-white/40">
                Density:{" "}
                <span className="text-white/70 font-medium">
                  {stats.density}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-white/40">
                Platforms:{" "}
                <span className="text-white/70 font-medium">
                  {chordStats.platforms}
                </span>
              </span>
              <span className="text-xs text-white/40">
                Cross-platform edges:{" "}
                <span className="text-white/70 font-medium">
                  {chordStats.crossPlatform}
                </span>
              </span>
              <span className="text-xs text-white/40">
                Within-platform edges:{" "}
                <span className="text-white/70 font-medium">
                  {chordStats.withinPlatform}
                </span>
              </span>
              <span className="text-xs text-white/40">
                Total edges:{" "}
                <span className="text-white/70 font-medium">
                  {stats.edges}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

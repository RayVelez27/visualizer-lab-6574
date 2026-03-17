"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Box, Network, Grid3X3 } from "lucide-react";

const tools = [
  {
    href: "/ordination",
    icon: Box,
    title: "3D Ordination",
    desc: "Explore Joint-RPCA principal components in 3D space",
    color: "#8b5cf6",
  },
  {
    href: "/network",
    icon: Network,
    title: "Correlation Network",
    desc: "Cross-platform metabolite correlations as a graph",
    color: "#f59e0b",
  },
  {
    href: "/heatmap",
    icon: Grid3X3,
    title: "Correlation Heatmap",
    desc: "Spearman correlations with significance filtering",
    color: "#06b6d4",
  },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* Subtle background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.05) 0%, transparent 50%)",
        }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          <span className="gradient-text">IMiC</span>{" "}
          <span className="text-white/80">Milk Composition</span>
        </h1>
        <p className="mt-3 text-sm text-white/40 max-w-md mx-auto">
          Interactive visualization demo — synthetic data
        </p>
      </motion.div>

      {/* Tool grid */}
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {tools.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.href}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
            >
              <Link href={t.href} className="block">
                <div
                  className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  {/* Accent line */}
                  <div
                    className="absolute left-0 top-0 h-full w-[3px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ backgroundColor: t.color }}
                  />

                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
                      style={{ backgroundColor: `${t.color}10` }}
                    >
                      <Icon
                        className="h-5 w-5 transition-colors duration-300"
                        style={{ color: `${t.color}99` }}
                      />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-white/90 group-hover:text-white transition-colors">
                        {t.title}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-white/35 group-hover:text-white/50 transition-colors">
                        {t.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

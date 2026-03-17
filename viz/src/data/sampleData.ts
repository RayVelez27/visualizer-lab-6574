// Synthetic data mirroring the real IMiC mammary gland project schema
// Real data lives in external Dropbox — this enables standalone demo

import * as d3 from "d3";

// ── Seed-able pseudo-random ──────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const rnorm = (mu = 0, sigma = 1) => {
  const u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Types ────────────────────────────────────────────────────────────
export interface Sample {
  sampleId: string;
  subjectId: string;
  cohort: "MISAME" | "VITAL" | "CHILD";
  timepoint: number;
  timepointLabel: string;
  bep: boolean;
  wazM04: number;
  wazCategory: "<-1" | ">0" | "mid";
  pc1: number;
  pc2: number;
  pc3: number;
}

export interface Metabolite {
  name: string;
  platform: "Micronutrients" | "Macronutrients" | "Biocrates" | "HMO" | "Untargeted" | "Proteomics";
  pc1Loading: number;
  pc2Loading: number;
  category: "numerator" | "denominator";
}

export interface LogRatioPoint {
  sampleId: string;
  cohort: string;
  timepoint: number;
  timepointLabel: string;
  platform: string;
  logRatio: number;
  bep: boolean;
  wazCategory: string;
}

export interface ShapFeature {
  feature: string;
  platform: string;
  importance: number;
  direction: "positive" | "negative";
  type: "growth" | "BEP";
}

export interface NetworkNode {
  id: string;
  platform: string;
  importance: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  correlation: number;
}

export interface CorrelationCell {
  metabolite: string;
  protein: string;
  rho: number;
  pValue: number;
  significant: boolean;
  cohort: string;
}

// ── Cohort configs ───────────────────────────────────────────────────
const COHORTS = {
  MISAME: {
    n: 80,
    timepoints: [
      { tp: 1, label: "14-21 Days" },
      { tp: 2, label: "1-2 Months" },
      { tp: 3, label: "3-4 Months" },
    ],
  },
  VITAL: {
    n: 60,
    timepoints: [
      { tp: 1, label: "40 Days" },
      { tp: 2, label: "56 Days" },
    ],
  },
  CHILD: {
    n: 50,
    timepoints: [{ tp: 1, label: "3 Months" }],
  },
} as const;

// ── Platform metabolites ─────────────────────────────────────────────
const METABOLITE_NAMES: Record<string, string[]> = {
  Micronutrients: [
    "Vitamin B1", "Vitamin B2", "Vitamin B3", "Vitamin B5", "Vitamin B6",
    "Vitamin B12", "Folate", "Calcium", "Manganese", "Selenium",
    "Potassium", "Zinc", "Iron", "Iodine", "Choline",
  ],
  Macronutrients: [
    "Total Protein", "Total Fat", "Lactose", "Total Energy",
    "Casein", "Whey", "SFA", "MUFA", "PUFA",
  ],
  Biocrates: [
    "Carnitine C0", "Carnitine C2", "Carnitine C3", "Carnitine C16",
    "Alanine", "Glutamine", "Glycine", "Leucine", "Valine",
    "SM C16:0", "SM C18:0", "PC aa C36:1", "PC aa C38:4",
    "LysoPC a C16:0", "LysoPC a C18:1",
  ],
  HMO: [
    "2'-FL", "3-FL", "LNT", "LNnT", "3'-SL", "6'-SL",
    "LNFP I", "LNFP II", "LNFP III", "DSLNT", "LSTb", "LSTc",
  ],
  Untargeted: Array.from({ length: 20 }, (_, i) => `Feature_${i + 1}`),
  Proteomics: [
    "Lactoferrin", "Alpha-lactalbumin", "Osteopontin", "Lysozyme",
    "IgA", "Bile salt-stimulated lipase", "Casein beta",
    "Lactadherin", "Tenascin", "Clusterin", "CD14", "Mucin-1",
  ],
};

// ── Generate samples ─────────────────────────────────────────────────
function generateSamples(): Sample[] {
  const samples: Sample[] = [];
  for (const [cohortName, cfg] of Object.entries(COHORTS)) {
    const cohort = cohortName as Sample["cohort"];
    for (let subj = 0; subj < cfg.n; subj++) {
      const subjectId = `${cohort}_S${String(subj + 1).padStart(3, "0")}`;
      const bep = rng() < 0.3;
      const waz = rnorm(-0.5, 1.2);
      const wazCat: Sample["wazCategory"] = waz < -1 ? "<-1" : waz > 0 ? ">0" : "mid";

      for (const { tp, label } of cfg.timepoints) {
        const bepShift = bep ? 1.5 : 0;
        const wazShift = waz * 0.8;
        const tpShift = (tp - 2) * 0.7;

        samples.push({
          sampleId: `${subjectId}_TP${tp}`,
          subjectId,
          cohort,
          timepoint: tp,
          timepointLabel: label,
          bep,
          wazM04: waz,
          wazCategory: wazCat,
          pc1: rnorm(bepShift + tpShift, 2.5),
          pc2: rnorm(wazShift, 2.0),
          pc3: rnorm(tpShift * 0.5, 1.8),
        });
      }
    }
  }
  return samples;
}

// ── Generate metabolite loadings ─────────────────────────────────────
function generateMetabolites(): Metabolite[] {
  const metabolites: Metabolite[] = [];
  for (const [platform, names] of Object.entries(METABOLITE_NAMES)) {
    for (const name of names) {
      const pc1 = rnorm(0, 0.5);
      const pc2 = rnorm(0, 0.4);
      metabolites.push({
        name,
        platform: platform as Metabolite["platform"],
        pc1Loading: pc1,
        pc2Loading: pc2,
        category: pc1 > 0 ? "numerator" : "denominator",
      });
    }
  }
  return metabolites.sort((a, b) => Math.abs(b.pc1Loading) - Math.abs(a.pc1Loading));
}

// ── Generate log-ratio data ──────────────────────────────────────────
function generateLogRatios(samples: Sample[]): LogRatioPoint[] {
  const platforms = ["Micronutrients", "Biocrates", "HMO", "Untargeted"];
  const points: LogRatioPoint[] = [];
  for (const s of samples) {
    for (const platform of platforms) {
      const bepEffect = s.bep ? 0.4 : -0.3;
      const wazEffect = s.wazM04 * 0.2;
      const tpEffect = (s.timepoint - 1) * -0.15;
      points.push({
        sampleId: s.sampleId,
        cohort: s.cohort,
        timepoint: s.timepoint,
        timepointLabel: s.timepointLabel,
        platform,
        logRatio: rnorm(bepEffect + wazEffect + tpEffect, 0.6),
        bep: s.bep,
        wazCategory: s.wazCategory,
      });
    }
  }
  return points;
}

// ── SHAP feature importance ──────────────────────────────────────────
function generateShapFeatures(): ShapFeature[] {
  const features: ShapFeature[] = [];
  const allMetabolites = Object.entries(METABOLITE_NAMES).flatMap(([platform, names]) =>
    names.slice(0, 5).map((name) => ({ name, platform }))
  );
  for (const { name, platform } of allMetabolites) {
    features.push({
      feature: name,
      platform,
      importance: Math.abs(rnorm(0, 0.15)),
      direction: rng() > 0.5 ? "positive" : "negative",
      type: rng() > 0.4 ? "growth" : "BEP",
    });
  }
  return features.sort((a, b) => b.importance - a.importance);
}

// ── Network data ─────────────────────────────────────────────────────
function generateNetwork(): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const nodes: NetworkNode[] = [];
  const metaboliteList = Object.entries(METABOLITE_NAMES).flatMap(([platform, names]) =>
    names.slice(0, 6).map((name) => ({ id: name, platform, importance: Math.abs(rnorm(0, 1)) }))
  );
  nodes.push(...metaboliteList);

  const edges: NetworkEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const corr = rnorm(0, 0.4);
      if (Math.abs(corr) > 0.3) {
        edges.push({
          source: nodes[i].id,
          target: nodes[j].id,
          correlation: Math.max(-1, Math.min(1, corr)),
        });
      }
    }
  }
  return { nodes, edges };
}

// ── Heatmap correlation data ─────────────────────────────────────────
function generateCorrelations(): CorrelationCell[] {
  const cells: CorrelationCell[] = [];
  const metabolites = [
    ...METABOLITE_NAMES.Micronutrients.slice(0, 8),
    ...METABOLITE_NAMES.Biocrates.slice(0, 6),
    ...METABOLITE_NAMES.HMO.slice(0, 6),
  ];
  const proteins = METABOLITE_NAMES.Proteomics;
  for (const cohort of ["MISAME", "VITAL"]) {
    for (const metabolite of metabolites) {
      for (const protein of proteins) {
        const rho = rnorm(0, 0.35);
        const p = Math.exp(-Math.abs(rho) * 8 + rng() * 3);
        cells.push({
          metabolite,
          protein,
          rho: Math.max(-1, Math.min(1, rho)),
          pValue: Math.min(1, Math.max(0, p)),
          significant: p < 0.05,
          cohort,
        });
      }
    }
  }
  return cells;
}

// ── Export all datasets ──────────────────────────────────────────────
export const samples = generateSamples();
export const metabolites = generateMetabolites();
export const logRatios = generateLogRatios(samples);
export const shapFeatures = generateShapFeatures();
export const networkData = generateNetwork();
export const correlations = generateCorrelations();

// ── Derived constants ────────────────────────────────────────────────
export const PLATFORM_COLORS: Record<string, string> = {
  Micronutrients: "#06b6d4",
  Macronutrients: "#8b5cf6",
  Biocrates: "#f59e0b",
  HMO: "#10b981",
  Untargeted: "#ef4444",
  Proteomics: "#3b82f6",
};

export const COHORT_COLORS: Record<string, string> = {
  MISAME: "#6366f1",
  VITAL: "#f97316",
  CHILD: "#22c55e",
};

export const BEP_COLORS = { Yes: "#ef4444", No: "#3b82f6" };
export const WAZ_COLORS: Record<string, string> = { "<-1": "#ef4444", mid: "#a3a3a3", ">0": "#22c55e" };

import type { RiskLevel, RuleTriggered } from "../api/types";

export interface RiskConfig {
  level: RiskLevel;
  label: string;
  score: number;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export const RISK_CONFIGS: Record<RiskLevel, RiskConfig> = {
  LOW: {
    level: "LOW",
    label: "Low Risk",
    score: 0,
    color: "#10b981", // emerald-500
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
    description: "Optimal conditions. Standard driving precautions.",
  },
  MODERATE: {
    level: "MODERATE",
    label: "Moderate Risk",
    score: 1,
    color: "#f59e0b", // amber-500
    bgClass: "bg-amber-500/15",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-500/30",
    description: "Moderate wind, rain, or light snow. Reduce speed and maintain distance.",
  },
  HIGH: {
    level: "HIGH",
    label: "High Risk",
    score: 2,
    color: "#f97316", // orange-500
    bgClass: "bg-orange-500/15",
    textClass: "text-orange-600 dark:text-orange-400",
    borderClass: "border-orange-500/30",
    description: "High crosswinds, moderate rain, or snow. Exercise heightened vigilance.",
  },
  SEVERE: {
    level: "SEVERE",
    label: "Severe Risk",
    score: 3,
    color: "#ef4444", // red-500
    bgClass: "bg-red-500/15",
    textClass: "text-red-600 dark:text-red-400",
    borderClass: "border-red-500/30",
    description: "Severe weather conditions. High rollover or traction risk.",
  },
  NO_TRAVEL: {
    level: "NO_TRAVEL",
    label: "No Travel",
    score: 4,
    color: "#991b1b", // red-800
    bgClass: "bg-rose-950/80",
    textClass: "text-rose-300",
    borderClass: "border-rose-800",
    description: "Extreme weather danger. Travel not recommended or prohibited.",
  },
};

export const UNKNOWN_RISK_CONFIG: RiskConfig = {
  level: "LOW",
  label: "Unknown Risk",
  score: -1,
  color: "#64748b", // slate-500
  bgClass: "bg-slate-500/15",
  textClass: "text-slate-400",
  borderClass: "border-slate-500/30",
  description: "Weather data unavailable for this point.",
};

export function getRiskConfig(level?: RiskLevel | null): RiskConfig {
  if (!level || !RISK_CONFIGS[level]) {
    return UNKNOWN_RISK_CONFIG;
  }
  return RISK_CONFIGS[level];
}

export function getRiskColor(level?: RiskLevel | null): string {
  return getRiskConfig(level).color;
}

export function getRuleTriggeredDetails(
  rule: RuleTriggered,
): { title: string; explanation: string } | null {
  switch (rule) {
    case "WIND_LOAD":
      return {
        title: "Wind & Load Hazard",
        explanation:
          "High crosswinds combined with cargo load weight exceed vehicle stability limits.",
      };
    case "WIND":
      return {
        title: "High Wind Hazard",
        explanation: "Elevated wind velocity presents dangerous buffeting conditions.",
      };
    case "RAIN":
      return {
        title: "Heavy Rain Hazard",
        explanation: "Intense rainfall increases hydroplaning risk and impairs visibility.",
      };
    case "SNOW":
      return {
        title: "Snowfall Hazard",
        explanation: "Accumulating snow creates slick road surfaces and reduced braking control.",
      };
    default:
      return null;
  }
}

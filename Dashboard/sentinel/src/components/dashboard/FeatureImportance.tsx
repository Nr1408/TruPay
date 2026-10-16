import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FEATURE_IMPORTANCE } from "@/lib/fraud-mock";
import type { Transaction } from "@/lib/fraud-mock";
import {
  fetchExplainability,
  type ExplainResponse,
  type ModelKey,
} from "@/lib/dashboard-telemetry";
import { cn } from "@/lib/utils";

const TOP_KEYS = new Set(["blacklist", "amount"]);

// Abbreviate long names so they fit in the narrow side panel
const SHORT_NAMES: Record<string, string> = {
  "Recipient Blacklist": "Blacklist",
  "Transaction Amount": "Txn Amount",
  "Behavioral Biometrics": "Behavior",
  "Location Mismatch": "Location",
  "VPN / Proxy Detected": "VPN/Proxy",
  "Device Trust Score": "Device Trust",
  "Velocity (1h)": "Velocity",
  "New Recipient": "New Recip.",
  "IP Reputation": "IP Rep.",
  "Hour of Day": "Hour",
  "Merchant Category": "Merchant",
  "Recipient Age (days)": "Recip. Age",
  "Avg Txn / Day": "Avg Txn/Day",
  "Failed Attempts": "Failed Att.",
  "Session Duration": "Session",
  "App Tampering Flag": "App Tamper",
  "SIM Swap Detected": "SIM Swap",
  "Network Type": "Network",
  "Geo Velocity": "Geo Vel.",
  "Battery Anomaly": "Battery",
  "Keystroke Cadence": "Keystroke",
  "Screen Recording Flag": "Screen Rec.",
};

const MODEL_OPTIONS: Array<{ key: ModelKey; label: string; auc: number; gain: number }> = [
  { key: "random_forest", label: "Random Forest", auc: 0.968, gain: 1 },
  { key: "xgboost", label: "XGBoost", auc: 0.977, gain: 1.08 },
  { key: "neural_net", label: "Neural Net", auc: 0.962, gain: 0.95 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seriesForFeature(weight: number, index: number, model: ModelKey): number[] {
  const wobble = model === "xgboost" ? 0.08 : model === "neural_net" ? 0.12 : 0.06;

  return Array.from({ length: 7 }, (_, day) => {
    const wave = Math.sin(index * 0.9 + day * 0.75 + (model === "neural_net" ? 0.6 : 0));
    const value = weight * (1 + wave * wobble);
    return +value.toFixed(4);
  });
}

function Sparkline({ values }: { values: number[] }) {
  const width = 160;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full">
      <polyline fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="1.8" points={points} />
    </svg>
  );
}

interface FeatureImportanceProps {
  transaction: Transaction | null;
}

export function FeatureImportance({ transaction }: FeatureImportanceProps) {
  const [model, setModel] = useState<ModelKey>("random_forest");
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [shapOpen, setShapOpen] = useState(true);

  const activeModel = MODEL_OPTIONS.find((option) => option.key === model) ?? MODEL_OPTIONS[0];

  const data = useMemo(() => {
    const scaled = FEATURE_IMPORTANCE.map((feature, index) => {
      const modulation = 1 + Math.sin(index * 0.7 + (model === "xgboost" ? 0.9 : 0.2)) * 0.09;
      const weight = clamp(feature.weight * activeModel.gain * modulation, 0.001, 0.35);
      const trend = seriesForFeature(weight, index, model);
      const first = trend[0] || 0.001;
      const driftPct = ((trend[6] - first) / first) * 100;

      return {
        ...feature,
        shortName: SHORT_NAMES[feature.name] ?? feature.name,
        weight,
        pct: +(weight * 100).toFixed(1),
        trend,
        driftPct,
      };
    });

    const total = scaled.reduce((acc, row) => acc + row.weight, 0);
    return scaled
      .map((row) => ({ ...row, weight: row.weight / total, pct: +(((row.weight / total) * 100).toFixed(1)) }))
      .sort((a, b) => b.weight - a.weight);
  }, [activeModel.gain, model]);

  useEffect(() => {
    if (!transaction) {
      setExplain(null);
      return;
    }

    let mounted = true;
    setLoadingExplain(true);

    fetchExplainability(transaction.id, model)
      .then((response) => {
        if (mounted) {
          setExplain(response);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingExplain(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [model, transaction]);

  const waterfallSteps = useMemo(() => {
    if (!explain) {
      return [] as Array<{
        feature: string;
        delta: number;
        start: number;
        end: number;
      }>;
    }

    let running = clamp(explain.baseRate, 0, 1);

    return explain.contributions.map((row) => {
      const start = running;
      const end = clamp(start + row.value, 0, 1);
      running = end;
      return {
        feature: row.feature,
        delta: row.value,
        start,
        end,
      };
    });
  }, [explain]);

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-card min-h-0">
        <div className="space-y-3 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Feature Importance</h2>
            </div>
            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {activeModel.label} · n={FEATURE_IMPORTANCE.length}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="relative z-10 inline-flex rounded-lg border border-border bg-background/60 p-1">
              {MODEL_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  onClick={() => setModel(option.key)}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    model === option.key
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[10px] text-emerald-400">
              AUC {activeModel.auc.toFixed(3)}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-3 py-3">
          <div className="space-y-2">
            {data.map((row) => (
              <div key={row.key} className="h-[72px] overflow-hidden rounded-md border border-border bg-background/35 px-2 py-2 flex flex-col justify-between">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate whitespace-nowrap text-[11px] font-semibold text-foreground">{row.shortName}</p>
                    {Math.abs(row.driftPct) > 15 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-zinc-900 text-zinc-100">
                          7-day drift {row.driftPct.toFixed(1)}% (threshold 15%)
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="font-mono text-[10px] font-semibold text-zinc-300">{row.pct.toFixed(1)}%</p>
                </div>

                <div className="h-2 rounded bg-zinc-800">
                  <div
                    className={cn(
                      "h-2 rounded transition-[width] duration-500",
                      TOP_KEYS.has(row.key) ? "bg-red-500" : "bg-primary",
                    )}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="min-w-0 flex-1 cursor-help">
                        <Sparkline values={row.trend} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-zinc-900 text-zinc-100">
                      <div className="space-y-1 text-[10px]">
                        <p className="font-semibold text-emerald-300">Last 7 days weight trend</p>
                        <p className="font-mono text-zinc-200">
                          {row.trend.map((value) => value.toFixed(3)).join(" | ")}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="whitespace-nowrap text-[10px] text-zinc-500">7D drift {row.driftPct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-zinc-950/60 p-3">
            <button
              type="button"
              onClick={() => setShapOpen((prev) => !prev)}
              className="mb-2 flex w-full items-center justify-between rounded-md border border-zinc-800 bg-black/20 px-2 py-2"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">SHAP Waterfall</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-400">
                  {loadingExplain ? "loading..." : transaction ? `txn ${transaction.id.slice(-6)}` : "select a txn"}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", shapOpen && "rotate-180")} />
              </div>
            </button>

            {shapOpen && (
              <div className="space-y-2">
                {!transaction && <p className="text-[11px] text-zinc-500">Select a transaction to view explanation.</p>}

                {transaction && explain && (
                  <>
                    <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-black/30 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Final Score</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] font-black",
                          explain.finalScore >= 0.75
                            ? "bg-red-500/20 text-red-300"
                            : explain.finalScore >= 0.45
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300",
                        )}
                      >
                        {(explain.finalScore * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="rounded-md border border-zinc-800 bg-black/20 px-2 py-1 text-[10px] text-zinc-500">
                      Base rate line at {(explain.baseRate * 100).toFixed(1)}%
                    </div>

                    {waterfallSteps.map((step) => {
                      const left = Math.min(step.start, step.end) * 100;
                      const width = Math.max(Math.abs(step.end - step.start) * 100, 0.8);
                      return (
                        <div key={`${step.feature}-${step.start}`}>
                          <div className="mb-1 flex items-center justify-between text-[10px]">
                            <span className="text-zinc-400">{step.feature}</span>
                            <span className={cn("font-mono", step.delta >= 0 ? "text-red-300" : "text-emerald-300")}>
                              {step.delta >= 0 ? "+" : ""}
                              {(step.delta * 100).toFixed(1)}
                            </span>
                          </div>
                          <div className="relative h-5 rounded border border-zinc-800 bg-zinc-900/60">
                            <div
                              className="absolute inset-y-0 w-px bg-zinc-500"
                              style={{ left: `${step.start * 100}%` }}
                            />
                            <div
                              className={cn(
                                "absolute top-0.5 h-4 rounded",
                                step.delta >= 0 ? "bg-red-500/70" : "bg-emerald-500/70",
                              )}
                              style={{ left: `${left}%`, width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger shadow-[0_0_6px_rgba(239,68,68,0.4)]" /> Top influencer
            </span>
            <span className="font-mono">Sigma weight = 1.000</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

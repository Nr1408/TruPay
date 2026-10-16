import { useMemo, useState } from "react";
import { Activity, ChevronDown, Gauge, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FEATURE_IMPORTANCE } from "@/lib/fraud-mock";
import { requestModelRetraining } from "@/lib/dashboard-telemetry";
import { cn } from "@/lib/utils";

interface ModelHealthPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface HealthMetric {
  key: string;
  label: string;
  value: number;
  trend: number[];
}

function miniSeries(seed: number, center: number) {
  return Array.from({ length: 7 }, (_, idx) => {
    const n = Math.sin(seed + idx * 0.75) * 0.03;
    return Math.max(0, Math.min(1, center + n));
  });
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 30;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full">
      <polyline fill="none" stroke="rgba(16,185,129,0.85)" strokeWidth="2" points={points} />
    </svg>
  );
}

export function ModelHealthPanel({ isOpen, onToggle }: ModelHealthPanelProps) {
  const [retrainedAt, setRetrainedAt] = useState<string>(new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString());
  const [dataVersion, setDataVersion] = useState<string>("v2026.04.18");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metrics = useMemo<HealthMetric[]>(
    () => [
      { key: "precision", label: "Precision", value: 0.941, trend: miniSeries(0.4, 0.93) },
      { key: "recall", label: "Recall", value: 0.907, trend: miniSeries(1.2, 0.9) },
      { key: "f1", label: "F1", value: 0.923, trend: miniSeries(2.1, 0.91) },
      { key: "roc", label: "ROC-AUC", value: 0.968, trend: miniSeries(3.3, 0.96) },
    ],
    [],
  );

  const psiRows = useMemo(
    () =>
      FEATURE_IMPORTANCE.slice(0, 10).map((feature, idx) => {
        const psi = Math.max(0.03, Math.min(0.26, 0.05 + idx * 0.017 + Math.sin(idx) * 0.03));
        return {
          name: feature.name,
          psi,
        };
      }),
    [],
  );

  const handleRetrain = async () => {
    setIsSubmitting(true);
    try {
      const snapshot = {
        precision: metrics[0].value,
        recall: metrics[1].value,
        f1: metrics[2].value,
        rocAuc: metrics[3].value,
        dataVersion,
      };

      const response = await requestModelRetraining(snapshot);
      setRetrainedAt(response.retrainedAt);
      setDataVersion(response.dataVersion);
      toast.success("Retraining requested", {
        description: `Model pipeline acknowledged at ${new Date(response.retrainedAt).toLocaleTimeString("en-IN")}`,
      });
    } catch {
      toast.error("Could not request retraining");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Model Health</h2>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <div key={metric.key} className="rounded-md border border-border bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
                <p className="mt-1 font-mono text-xl font-black text-emerald-400">{(metric.value * 100).toFixed(1)}%</p>
                <Sparkline values={metric.trend} />
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold text-foreground">PSI by Feature</p>
            </div>
            <div className="space-y-1.5">
              {psiRows.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-[11px]">
                  <span className="truncate text-muted-foreground">{row.name}</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      row.psi > 0.2 && "text-red-400",
                      row.psi > 0.1 && row.psi <= 0.2 && "text-amber-400",
                      row.psi <= 0.1 && "text-emerald-400",
                    )}
                  >
                    {row.psi.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleRetrain} disabled={isSubmitting} className="w-full gap-2">
            <RefreshCw className={cn("h-4 w-4", isSubmitting && "animate-spin")} />
            {isSubmitting ? "Submitting..." : "Request Retraining"}
          </Button>

          <div className="text-[10px] text-muted-foreground">
            <p>Last retrained: <span className="font-mono text-foreground">{new Date(retrainedAt).toLocaleString("en-IN")}</span></p>
            <p>Training data version: <span className="font-mono text-foreground">{dataVersion}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

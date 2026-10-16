import { useEffect, useMemo, useState } from "react";
import { fetchLiveMetrics, type MetricPoint } from "@/lib/dashboard-telemetry";
import { cn } from "@/lib/utils";

type MetricState = "safe" | "warn" | "danger";

const REFRESH_MS = 2000;

function asMetricState(metric: MetricPoint): MetricState {
  const value = Number(metric.value);
  const label = metric.label.toLowerCase();

  if (label.includes("transactions/sec")) {
    if (value >= 18) return "safe";
    if (value >= 14.4) return "warn";
    return "danger";
  }

  if (label.includes("fraud rate")) {
    if (value <= 3.5) return "safe";
    if (value <= 4.2) return "warn";
    return "danger";
  }

  if (label.includes("false positive")) {
    if (value <= 1.5) return "safe";
    if (value <= 1.8) return "warn";
    return "danger";
  }

  if (label.includes("latency")) {
    if (value <= 180) return "safe";
    if (value <= 216) return "warn";
    return "danger";
  }

  if (label.includes("active sessions")) {
    if (value >= 50) return "safe";
    if (value >= 40) return "warn";
    return "danger";
  }

  return "safe";
}

function formatMetricValue(metric: MetricPoint): string {
  if (metric.unit === "%") {
    return `${metric.value.toFixed(2)}%`;
  }

  if (metric.unit === "ms") {
    return `${Math.round(metric.value)} ms`;
  }

  if (metric.unit === "tps") {
    return `${metric.value.toFixed(1)}`;
  }

  return `${Math.round(metric.value)}`;
}

export function LiveMetricsBar() {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const next = await fetchLiveMetrics();
      if (mounted) {
        setMetrics(next);
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const rendered = useMemo(() => metrics.slice(0, 5), [metrics]);

  return (
    <div className="h-full border-b border-zinc-800 bg-black/80 px-2 py-1 backdrop-blur-md">
      <div className="grid h-full grid-cols-5 gap-2">
        {rendered.map((metric) => {
          const state = asMetricState(metric);
          return (
            <div
              key={metric.label}
              className={cn(
                "min-w-0 rounded-lg border px-2 py-1",
                state === "safe" && "border-emerald-500/40 bg-emerald-500/5",
                state === "warn" && "border-amber-500/40 bg-amber-500/5",
                state === "danger" && "border-red-500/40 bg-red-500/5",
              )}
            >
              <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                {metric.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate font-mono text-[20px] font-black leading-none",
                  state === "safe" && "text-emerald-400",
                  state === "warn" && "text-amber-400",
                  state === "danger" && "text-red-400",
                )}
              >
                {formatMetricValue(metric)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

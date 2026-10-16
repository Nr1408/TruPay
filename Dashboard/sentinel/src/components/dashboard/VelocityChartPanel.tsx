import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  type TooltipItem,
  Tooltip,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import { AreaChart } from "lucide-react";

interface VelocityPoint {
  bucket: string;
  volume: number;
  fraudRate: number;
  baselineFraudRate: number;
  anomaly: boolean;
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, annotationPlugin);

function buildVelocitySeries(): VelocityPoint[] {
  const now = new Date();
  const points: VelocityPoint[] = [];
  let rolling = 1.6;

  for (let i = 95; i >= 0; i -= 1) {
    const ts = new Date(now.getTime() - i * 15 * 60 * 1000);
    const hour = ts.getHours();
    const minute = ts.getMinutes().toString().padStart(2, "0");

    const wave = Math.sin((95 - i) / 6) * 18;
    const burst = Math.max(0, Math.cos((95 - i) / 12) * 22);
    const volume = Math.max(12, Math.round(45 + wave + burst));

    const baseFraud = 1.35 + Math.abs(Math.sin((95 - i) / 9)) * 0.8;
    const spike = (95 - i) % 21 === 0 ? 2.9 : 0;
    const fraudRate = +(baseFraud + spike).toFixed(2);

    rolling = rolling * 0.84 + fraudRate * 0.16;
    const anomaly = fraudRate > rolling * 2;

    points.push({
      bucket: `${hour.toString().padStart(2, "0")}:${minute}`,
      volume,
      fraudRate,
      baselineFraudRate: +(baseFraud * 0.92).toFixed(2),
      anomaly,
    });
  }

  return points;
}

function buildAnomalyBands(points: VelocityPoint[]) {
  const bands: Array<{ start: number; end: number }> = [];
  let startIndex: number | null = null;

  points.forEach((point, index) => {
    if (point.anomaly && startIndex === null) {
      startIndex = index;
      return;
    }

    if (!point.anomaly && startIndex !== null) {
      bands.push({ start: Math.max(0, startIndex - 1), end: index });
      startIndex = null;
    }
  });

  if (startIndex !== null) {
    bands.push({ start: Math.max(0, startIndex - 1), end: points.length - 1 });
  }

  return bands;
}

export function VelocityChartPanel() {
  const data = useMemo(() => buildVelocitySeries(), []);
  const bands = useMemo(() => buildAnomalyBands(data), [data]);
  const annotationMap = useMemo(
    () =>
      Object.fromEntries(
        bands.map((band, index) => [
          `band-${index}`,
          {
            type: "box" as const,
            xMin: band.start,
            xMax: band.end,
            backgroundColor: "rgba(239,68,68,0.16)",
            borderColor: "rgba(239,68,68,0.35)",
            borderWidth: 1,
            yScaleID: "yFraud",
          },
        ]),
      ),
    [bands],
  );

  const chartData = useMemo(
    () => ({
      labels: data.map((point) => point.bucket),
      datasets: [
        {
          label: "Volume",
          yAxisID: "yVolume",
          data: data.map((point) => point.volume),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.12)",
          borderWidth: 2.2,
          pointRadius: 0,
          tension: 0.33,
        },
        {
          label: "Fraud Rate",
          yAxisID: "yFraud",
          data: data.map((point) => point.fraudRate),
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.16)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.34,
        },
        {
          label: "7d Baseline",
          yAxisID: "yFraud",
          data: data.map((point) => point.baselineFraudRate),
          borderColor: "#a1a1aa",
          borderWidth: 1.5,
          borderDash: [6, 5],
          pointRadius: 0,
          tension: 0.25,
        },
      ],
    }),
    [data],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      layout: {
        padding: {
          top: 26,
          right: 8,
          bottom: 18,
          left: 4,
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          align: "end" as const,
          fullSize: false,
          labels: {
            color: "#d4d4d8",
            boxWidth: 14,
            boxHeight: 2,
            usePointStyle: false,
            font: {
              size: 10,
            },
          },
        },
        tooltip: {
          backgroundColor: "#09090b",
          borderColor: "#27272a",
          borderWidth: 1,
          titleColor: "#fafafa",
          bodyColor: "#d4d4d8",
          padding: 10,
          callbacks: {
            label: (context: TooltipItem<"line">) => {
              const label = context.dataset.label ?? "Metric";
              const yValue = typeof context.parsed.y === "number" ? context.parsed.y : 0;
              if (label === "Volume") {
                return `${label}: ${yValue.toFixed(0)}`;
              }
              return `${label}: ${yValue.toFixed(2)}%`;
            },
          },
        },
        annotation: {
          annotations: annotationMap as any,
        } as any,
      },
      scales: {
        x: {
          grid: {
            color: "rgba(39,39,42,0.35)",
            drawBorder: false,
          },
          ticks: {
            color: "#71717a",
            maxTicksLimit: 12,
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: 10,
            },
          },
        },
        yVolume: {
          type: "linear" as const,
          position: "left" as const,
          grid: {
            color: "rgba(39,39,42,0.35)",
            drawBorder: false,
          },
          ticks: {
            color: "#71717a",
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: "Volume",
            color: "#a1a1aa",
            font: {
              size: 10,
              weight: "bold" as const,
            },
          },
        },
        yFraud: {
          type: "linear" as const,
          position: "right" as const,
          grid: {
            drawOnChartArea: false,
            drawBorder: false,
          },
          ticks: {
            color: "#71717a",
            callback: (value: number | string) => `${value}%`,
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: "Fraud Rate",
            color: "#a1a1aa",
            font: {
              size: 10,
              weight: "bold" as const,
            },
          },
        },
      },
      elements: {
        line: {
          capBezierPoints: true,
        },
      },
    }),
    [annotationMap],
  );

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-zinc-800 bg-black/85 shadow-2xl">
      <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-2">
        <AreaChart className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">24h Velocity</h3>
      </div>

      <div className="relative h-full w-full">
        <Line data={chartData} options={options} />
      </div>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-zinc-500">
        <span>green: volume · amber: fraud rate · dotted gray: 7d baseline</span>
        <span>red band: fraud rate &gt; 2x rolling avg</span>
      </div>
    </div>
  );
}

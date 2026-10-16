// Sentinel Hologram UI - v2.4.3
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  MapPin,
  PlayCircle,
  RotateCcw,
  Wifi,
  Zap,
  Activity,
  ShieldCheck,
  Cpu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowState, NodeStatus, Transaction } from "@/lib/fraud-mock";

interface NodeDef {
  key: keyof FlowState;
  label: string;
  sub: string;
  icon: LucideIcon;
  xPct: number;
  yPct: number;
}

const NODE_W = 200;
const NODE_H = 100;
const VIEW_W = 1000;
const VIEW_H = 500;

const NODES: NodeDef[] = [
  { key: "start",     label: "Transaction Ingress",   sub: "Gateway · UPI 2.0",     icon: Zap,         xPct: 0.02, yPct: 0.5 },
  { key: "blacklist", label: "Neural Blacklist",      sub: "Community Vault",       icon: Ban,         xPct: 0.29, yPct: 0.07 },
  { key: "location",  label: "Spatial Analysis",      sub: "Geo-Fencing · IP",      icon: MapPin,      xPct: 0.29, yPct: 0.5 },
  { key: "vpn",       label: "Network Integrity",     sub: "Proxy · VPN Scan",      icon: Wifi,        xPct: 0.29, yPct: 0.84 },
  { key: "behavior",  label: "Behavioral Core",       sub: "RLHF Intelligence",     icon: Cpu,         xPct: 0.58, yPct: 0.5 },
  { key: "verdict",   label: "Sentinel Verdict",      sub: "Decision Matrix",       icon: ShieldCheck, xPct: 0.87, yPct: 0.5 },
];

const EDGES: Array<{ from: keyof FlowState; to: keyof FlowState }> = [
  { from: "start", to: "blacklist" },
  { from: "start", to: "location" },
  { from: "start", to: "vpn" },
  { from: "blacklist", to: "behavior" },
  { from: "location", to: "behavior" },
  { from: "vpn", to: "behavior" },
  { from: "behavior", to: "verdict" },
];

interface DecisionSnapshot {
  id: string;
  verdict: "SAFE" | "FLAGGED" | "THREAT";
  riskScore: number;
  timestamp: number;
}

interface NodeTelemetry {
  latencyMs: number;
  subScore: number;
  rawInputs: Array<{ key: string; value: string }>;
  warnings: string[];
}

function statusTheme(status: NodeStatus, isVerdict = false) {
  if (status === "fail")
    return {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      glow: "shadow-[0_0_30px_-5px_rgba(239,68,68,0.4)]",
      icon: "text-red-500",
      iconBg: "bg-red-500/20",
      path: "stroke-red-500",
      pathGlow: "drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]",
      label: isVerdict ? "THREAT DETECTED" : "FLAGGED",
      labelBg: "bg-red-500",
      animate: ""
    };
  if (status === "pass")
    return {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      glow: "shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)]",
      icon: "text-emerald-500",
      iconBg: "bg-emerald-500/20",
      path: "stroke-emerald-500",
      pathGlow: "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]",
      label: isVerdict ? "VERIFIED SAFE" : "CLEARED",
      labelBg: "bg-emerald-500",
      animate: ""
    };
  if (status === "pending")
    return {
      border: "border-amber-500/40",
      bg: "bg-amber-500/5",
      glow: "shadow-[0_0_20px_-8px_rgba(245,158,11,0.3)]",
      icon: "text-amber-500",
      iconBg: "bg-amber-500/15",
      path: "stroke-amber-500",
      pathGlow: "drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]",
      label: "ANALYZING...",
      labelBg: "bg-amber-500",
      animate: "animate-pulse"
    };
  return {
    border: "border-zinc-800",
    bg: "bg-zinc-900/50",
    glow: "",
    icon: "text-zinc-500",
    iconBg: "bg-zinc-800/50",
    path: "stroke-zinc-800",
    pathGlow: "",
    label: "IDLE",
    labelBg: "bg-zinc-800",
    animate: ""
  };
}

interface AttackFlowCanvasProps {
  flow: FlowState;
  transaction: Transaction | null;
  detectionState: "idle" | "fraud" | "verified";
  decisionHistory: DecisionSnapshot[];
  isSimulating: boolean;
  onSimulate: () => void;
  onReset: () => void;
}

export function AttackFlowCanvas({
  flow,
  transaction,
  detectionState,
  decisionHistory,
  isSimulating,
  onSimulate,
  onReset,
}: AttackFlowCanvasProps) {
  const [activeNode, setActiveNode] = useState<keyof FlowState | null>(null);
  const positionedNodes = useMemo(
    () =>
      NODES.map((node) => ({
        ...node,
        x: node.xPct * (VIEW_W - NODE_W),
        y: node.yPct * (VIEW_H - NODE_H),
      })),
    [],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, (typeof positionedNodes)[number]>();
    positionedNodes.forEach((n) => map.set(n.key, n));
    return map;
  }, [positionedNodes]);

  const isThreatState = detectionState === "fraud" || flow.verdict === "fail";

  const threatNodes = useMemo(() => {
    const flagged = new Set<keyof FlowState>();
    if (!isThreatState) {
      return flagged;
    }

    flagged.add("start");
    flagged.add("verdict");

    (Object.keys(flow) as Array<keyof FlowState>).forEach((nodeKey) => {
      if (flow[nodeKey] === "fail") {
        flagged.add(nodeKey);
      }
    });

    return flagged;
  }, [flow, isThreatState]);

  const threatEdges = useMemo(() => {
    const flaggedEdges = new Set<string>();
    if (!isThreatState) {
      return flaggedEdges;
    }

    (["blacklist", "location", "vpn"] as const).forEach((nodeKey) => {
      if (flow[nodeKey] === "fail") {
        flaggedEdges.add(`start-${nodeKey}`);
        flaggedEdges.add(`${nodeKey}-behavior`);
      }
    });

    flaggedEdges.add("behavior-verdict");

    return flaggedEdges;
  }, [flow, isThreatState]);

  const nodeTelemetry = useMemo<NodeTelemetry | null>(() => {
    if (!activeNode || !transaction) {
      return null;
    }

    const f = transaction.features;
    const latencyBase: Record<keyof FlowState, number> = {
      start: 18,
      blacklist: 36,
      location: 28,
      vpn: 31,
      behavior: 44,
      verdict: 24,
    };

    const telemetrySubScore: Record<keyof FlowState, number> = {
      start: Math.min(1, Math.max(0, transaction.riskScore / 100)),
      blacklist: f.recipientBlacklisted ? 0.96 : 0.08,
      location: f.locationMismatch ? 0.89 : 0.12,
      vpn: f.vpnDetected ? 0.84 : 0.15,
      behavior: Math.min(1, Math.max(0, f.behavioralAnomaly * 0.7 + f.velocityScore * 0.3)),
      verdict: Math.min(1, Math.max(0, transaction.riskScore / 100)),
    };

    const rawInputsByNode: Record<keyof FlowState, Array<{ key: string; value: string }>> = {
      start: [
        { key: "upiId", value: transaction.upiId },
        { key: "amount", value: `Rs ${transaction.amount.toLocaleString("en-IN")}` },
        { key: "hourOfDay", value: String(f.hourOfDay) },
        { key: "newRecipient", value: String(f.newRecipient) },
      ],
      blacklist: [
        { key: "recipientBlacklisted", value: String(f.recipientBlacklisted) },
        { key: "ipReputation", value: f.ipReputation.toFixed(3) },
        { key: "velocityScore", value: f.velocityScore.toFixed(3) },
        { key: "riskScore", value: String(transaction.riskScore) },
      ],
      location: [
        { key: "locationMismatch", value: String(f.locationMismatch) },
        { key: "ipReputation", value: f.ipReputation.toFixed(3) },
        { key: "amountAnomaly", value: f.amountAnomaly.toFixed(3) },
        { key: "hourOfDay", value: String(f.hourOfDay) },
      ],
      vpn: [
        { key: "vpnDetected", value: String(f.vpnDetected) },
        { key: "ipReputation", value: f.ipReputation.toFixed(3) },
        { key: "deviceTrust", value: f.deviceTrust.toFixed(3) },
        { key: "velocityScore", value: f.velocityScore.toFixed(3) },
      ],
      behavior: [
        { key: "behavioralAnomaly", value: f.behavioralAnomaly.toFixed(3) },
        { key: "deviceTrust", value: f.deviceTrust.toFixed(3) },
        { key: "amountAnomaly", value: f.amountAnomaly.toFixed(3) },
        { key: "velocityScore", value: f.velocityScore.toFixed(3) },
      ],
      verdict: [
        { key: "riskScore", value: String(transaction.riskScore) },
        { key: "blacklist", value: String(f.recipientBlacklisted) },
        { key: "geoMismatch", value: String(f.locationMismatch) },
        { key: "behavioralAnomaly", value: f.behavioralAnomaly.toFixed(3) },
      ],
    };

    const rawInputs = rawInputsByNode[activeNode];

    const warnings: string[] = [];

    if (flow[activeNode] === "fail") {
      warnings.push("Node entered fail state and contributed to a flagged verdict.");
    }
    if (f.recipientBlacklisted) {
      warnings.push("Recipient appears in blacklist telemetry.");
    }
    if (f.locationMismatch) {
      warnings.push("Geo mismatch detected versus previous trusted location.");
    }
    if (f.vpnDetected) {
      warnings.push("Possible anonymized network path (VPN/Proxy) in use.");
    }
    if (!warnings.length) {
      warnings.push("No warnings at this node for the selected transaction.");
    }

    return {
      latencyMs: latencyBase[activeNode] + Math.round((transaction.riskScore % 11) * 1.7),
      subScore: telemetrySubScore[activeNode],
      rawInputs,
      warnings: warnings.slice(0, 5),
    };
  }, [activeNode, flow, transaction]);

  const latestDecisions = useMemo(() => decisionHistory.slice(0, 5), [decisionHistory]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveNode(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-black/90 shadow-2xl overflow-hidden relative group">
      {/* Background Cyber-Grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black" />
        <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-150 contrast-150" />
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff08 1px, transparent 0)`,
            backgroundSize: '32px 32px' 
          }} 
        />
        {/* Animated Scanning Line */}
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent top-0 animate-scan-y" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-zinc-800/50 bg-black/40 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            <div className="absolute inset-0 blur-md bg-primary/40 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Sentinel Flow</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Real-time Inference Matrix</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-9 w-9 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-400"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onSimulate}
            disabled={isSimulating}
            className="relative h-9 rounded-xl bg-primary px-4 font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:scale-105 active:scale-95 overflow-hidden group/btn"
          >
            <span className="relative z-10 flex items-center gap-2">
              <PlayCircle className={cn("h-4 w-4", isSimulating && "animate-spin")} />
              {isSimulating ? "Analyzing..." : "Initialize Scan"}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 overflow-hidden p-4">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker
              id="threat-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(239,68,68,0.95)" />
            </marker>
          </defs>

          {/* Animated Paths */}
          {EDGES.map((e, idx) => {
            const from = nodeMap.get(e.from)!;
            const to = nodeMap.get(e.to)!;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            
            const midX = (x1 + x2) / 2;
            const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

            const status = flow[e.to] === "fail" || flow[e.from] === "fail" ? "fail" :
              flow[e.to] === "pass" && flow[e.from] === "pass" ? "pass" :
                flow[e.to] === "pending" || flow[e.from] === "pending" ? "pending" : "idle";
            
            const theme = statusTheme(status);
            const edgeKey = `${e.from}-${e.to}`;
            const isThreatEdge = isThreatState && threatEdges.has(edgeKey);

            return (
              <g key={idx}>
                {/* Background path */}
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="2"
                />
                {/* Animated Flow Path */}
                <path
                  d={path}
                  fill="none"
                  className={cn(
                    "transition-all duration-1000",
                    isThreatEdge ? "stroke-red-500 drop-shadow-[0_0_9px_rgba(239,68,68,0.75)]" : theme.path,
                    isThreatEdge ? "" : theme.pathGlow,
                    status !== "idle" && !isThreatEdge && "animate-dash-flow",
                    isThreatEdge && "animate-threat-dash"
                  )}
                  strokeWidth={isThreatEdge || status === "fail" ? "3" : "2"}
                  strokeDasharray={isThreatEdge ? "7 6" : "8 12"}
                  strokeDashoffset={isThreatEdge ? 0 : undefined}
                  opacity={status === "idle" && !isThreatEdge ? 0.2 : 0.85}
                  markerEnd={isThreatEdge ? "url(#threat-arrow)" : undefined}
                />
                {/* Glow Core */}
                <path
                  d={path}
                  fill="none"
                  className={cn(
                    "transition-all duration-1000 blur-[2px]",
                    isThreatEdge ? "stroke-red-500" : theme.path
                  )}
                  strokeWidth="4"
                  opacity={status === "idle" ? 0 : 0.3}
                />
              </g>
            );
          })}

          {/* Holographic Nodes */}
          {positionedNodes.map((n) => {
            const status = flow[n.key];
            const theme = statusTheme(status, n.key === "verdict");
            const Icon = n.icon;
            const isThreatNode = isThreatState && threatNodes.has(n.key);

            return (
              <foreignObject
                key={n.key}
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                className="overflow-visible"
              >
                <button
                  type="button"
                  onClick={() => setActiveNode(n.key)}
                  className={cn(
                    "relative h-full w-full rounded-2xl border-2 p-4 transition-all duration-700 flex flex-col group/node text-left",
                    theme.bg,
                    theme.border,
                    theme.glow,
                    theme.animate,
                    "backdrop-blur-xl",
                    isThreatNode && "ring-2 ring-red-500/70 shadow-[0_0_28px_-4px_rgba(239,68,68,0.7)]",
                    activeNode === n.key && "ring-2 ring-primary/70",
                  )}
                >
                  {n.key === "verdict" && isThreatState && (
                    <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-red-500/25 blur-xl" />
                  )}
                  {/* Glass Highlight */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                  {isThreatNode && (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-red-500/80 animate-threat-border-pulse" />
                  )}
                  
                  <div className="flex items-start gap-3 relative z-10">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-500",
                      theme.iconBg,
                      status !== "idle" && "scale-110 shadow-lg"
                    )}>
                      <Icon className={cn("h-5 w-5", theme.icon)} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-white leading-tight">
                        {n.label}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase truncate mt-0.5">
                        {n.sub}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator Chip */}
                  <div className="mt-auto flex flex-col items-start gap-1 relative z-10">
                    <div className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black tracking-[0.15em] uppercase shadow-sm",
                      theme.labelBg,
                      "text-white"
                    )}>
                      {theme.label}
                    </div>
                    {n.key === "verdict" && status === "fail" && transaction?.scamType && (
                      <div className="flex items-center gap-1.5 animate-pulse text-red-500 px-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-tighter leading-tight">
                          {transaction.scamType}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Corner Accents */}
                  <div className={cn("absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 rounded-tl-lg", theme.border)} />
                  <div className={cn("absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 rounded-tr-lg", theme.border)} />
                  <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 rounded-bl-lg", theme.border)} />
                  <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 rounded-br-lg", theme.border)} />
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* Footer System Status */}
      <div className="relative z-10 border-t border-zinc-800 bg-black/60 px-6 py-3 backdrop-blur-md flex justify-between items-center">
        <div className="flex gap-4">
           <StatusBadge color="bg-emerald-500" label="SAFE" />
           <StatusBadge color="bg-red-500" label="THREAT" />
           <StatusBadge color="bg-amber-500" label="ANALYZING" />
        </div>
        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          System Operational
        </div>
      </div>

      {activeNode && (
        <>
          <button
            type="button"
            onClick={() => setActiveNode(null)}
            className="absolute inset-0 z-20 bg-black/45"
            aria-label="Close node detail drawer"
          />
          <aside
            className={cn(
              "absolute right-0 top-0 z-30 h-full w-[360px] border-l shadow-2xl backdrop-blur-md animate-in slide-in-from-right-8",
              flow[activeNode] === "fail"
                ? "border-red-500/50 bg-gradient-to-b from-red-950/45 via-zinc-950/95 to-zinc-950/95"
                : "border-zinc-700 bg-zinc-950/95",
            )}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Node Detail</p>
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">
                  {NODES.find((node) => node.key === activeNode)?.label}
                </h3>
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white",
                    flow[activeNode] === "fail" ? "bg-red-500" : "bg-emerald-500",
                  )}
                >
                  {flow[activeNode] === "fail" ? "FLAGGED" : "CLEARED"}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setActiveNode(null)}
                className="h-8 w-8 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="custom-scrollbar h-[calc(100%-4rem)] space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Latency</p>
                  <p className="font-mono text-lg font-black text-emerald-400">
                    {nodeTelemetry?.latencyMs ?? 0} ms
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Sub-score</p>
                  <p className="font-mono text-lg font-black text-amber-300">
                    {(((nodeTelemetry?.subScore ?? 0) * 100)).toFixed(1)}
                  </p>
                </div>
              </div>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                  Raw Input Feature Values
                </h4>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {(nodeTelemetry?.rawInputs ?? []).map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">{entry.key}</span>
                      <span className="font-mono text-zinc-200">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                  Last 5 Decisions
                </h4>
                <div className="space-y-1.5">
                  {latestDecisions.length === 0 && (
                    <p className="text-[11px] text-zinc-500">No decisions yet.</p>
                  )}
                  {latestDecisions.map((decision) => (
                    <div key={decision.id + decision.timestamp} className="flex items-center justify-between rounded-md border border-zinc-800 bg-black/30 px-2 py-1">
                      <span className={cn(
                        "text-[10px] font-black uppercase",
                        decision.verdict === "THREAT" && "text-red-400",
                        decision.verdict === "FLAGGED" && "text-amber-400",
                        decision.verdict === "SAFE" && "text-emerald-400",
                      )}>
                        {decision.verdict}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {new Date(decision.timestamp).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                  Warning Logs
                </h4>
                <div className="space-y-1.5">
                  {(nodeTelemetry?.warnings ?? []).map((warning) => (
                    <p key={warning} className="text-[11px] leading-relaxed text-amber-300">
                      {warning}
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", color, "shadow-[0_0_8px_rgba(255,255,255,0.2)]")} />
      <span className="text-[9px] font-black text-zinc-400 tracking-widest uppercase">{label}</span>
    </div>
  );
}

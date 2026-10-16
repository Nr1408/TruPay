import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Network } from "lucide-react";
import type { Transaction } from "@/lib/fraud-mock";
import { cn } from "@/lib/utils";

type RiskBand = "safe" | "warn" | "threat";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "transaction" | "account" | "device" | "ip" | "merchant";
  risk: RiskBand;
  volume: number;
  x?: number;
  y?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
}

function linkEndpointId(endpoint: string | GraphNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function linkEndpointX(endpoint: string | GraphNode): number {
  return typeof endpoint === "string" ? 0 : endpoint.x ?? 0;
}

function linkEndpointY(endpoint: string | GraphNode): number {
  return typeof endpoint === "string" ? 0 : endpoint.y ?? 0;
}

function pickRisk(value: number): RiskBand {
  if (value >= 75) return "threat";
  if (value >= 40) return "warn";
  return "safe";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildGraph(transaction: Transaction, pivot?: string) {
  const risk = transaction.riskScore;
  const sender = transaction.upiId.split("@")[0];
  const receiver = `${transaction.id.slice(-4)}_receiver`;
  const merchant = transaction.scamType ? "high_risk_merchant" : "merchant_482";
  const ip = `10.24.${transaction.amount % 255}.${(transaction.amount / 3) % 255 | 0}`;
  const device = `dfp_${transaction.id.slice(-6)}`;

  const senderRisk = clamp(risk * 0.72 - 8, 0, 100);
  const receiverRisk = clamp(risk * 0.97 + 6, 0, 100);
  const deviceRisk = clamp(risk * 0.58 + 2, 0, 100);
  const ipRisk = clamp(risk * 0.52, 0, 100);
  const merchantRisk = clamp(risk * 0.78 + 4, 0, 100);

  const nodes: GraphNode[] = [
    {
      id: `txn:${transaction.id}`,
      label: `Txn ${transaction.id.slice(-6)}`,
      type: "transaction",
      risk: pickRisk(risk),
      volume: 104,
    },
    {
      id: `acct:${sender}`,
      label: `Sender ${sender}`,
      type: "account",
      risk: pickRisk(senderRisk),
      volume: 72,
    },
    {
      id: `acct:${receiver}`,
      label: `Receiver ${receiver}`,
      type: "account",
      risk: pickRisk(receiverRisk),
      volume: 86,
    },
    {
      id: `device:${device}`,
      label: `Device ${device}`,
      type: "device",
      risk: pickRisk(deviceRisk),
      volume: 58,
    },
    {
      id: `ip:${ip}`,
      label: `IP ${ip}`,
      type: "ip",
      risk: pickRisk(ipRisk),
      volume: 52,
    },
    {
      id: `merchant:${merchant}`,
      label: `Merchant ${merchant}`,
      type: "merchant",
      risk: pickRisk(merchantRisk),
      volume: 66,
    },
  ];

  const links: GraphLink[] = [
    { source: `txn:${transaction.id}`, target: `acct:${sender}`, relation: "sender" },
    { source: `txn:${transaction.id}`, target: `acct:${receiver}`, relation: "receiver" },
    { source: `txn:${transaction.id}`, target: `device:${device}`, relation: "same device" },
    { source: `txn:${transaction.id}`, target: `ip:${ip}`, relation: "shared IP" },
    { source: `txn:${transaction.id}`, target: `merchant:${merchant}`, relation: "merchant" },
    { source: `acct:${receiver}`, target: `device:${device}`, relation: "prior transaction" },
  ];

  const focusId = pivot && nodes.some((node) => node.id === pivot) ? pivot : `txn:${transaction.id}`;
  return { nodes, links, focusId };
}

function riskColor(risk: RiskBand) {
  if (risk === "threat") return "#ef4444";
  if (risk === "warn") return "#f59e0b";
  return "#10b981";
}

export function EntityLinkGraph({ transaction }: { transaction: Transaction | null }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pivot, setPivot] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const graph = useMemo(() => {
    if (!transaction) return null;
    return buildGraph(transaction, pivot ?? undefined);
  }, [pivot, transaction]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.floor(container.clientWidth));
      const nextHeight = Math.max(0, Math.floor(container.clientHeight));
      setDimensions((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!graph || !svgRef.current || !dimensions.width || !dimensions.height) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = Math.max(280, dimensions.width);
    const height = Math.max(180, dimensions.height);
    const centerX = width / 2;
    const centerY = height / 2;
    const orbitRadius = Math.max(70, Math.min(width, height) * 0.29);

    const container = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const linkLayer = container.append("g");
    const labelLayer = container.append("g");
    const nodeLayer = container.append("g");

    const ringNodes = graph.nodes.filter((node) => node.id !== graph.focusId);
    const angleById = new Map<string, number>(
      ringNodes.map((node, index) => [
        node.id,
        (Math.PI * 2 * index) / Math.max(1, ringNodes.length),
      ]),
    );

    graph.nodes.forEach((node) => {
      if (node.id === graph.focusId) {
        node.x = centerX;
        node.y = centerY;
        return;
      }

      const angle = angleById.get(node.id) ?? 0;
      node.x = centerX + Math.cos(angle) * orbitRadius;
      node.y = centerY + Math.sin(angle) * orbitRadius;
    });

    const simulation = d3
      .forceSimulation(graph.nodes)
      .force(
        "link",
        d3
          .forceLink(graph.links)
          .id((d) => (d as GraphNode).id)
          .distance((d: GraphLink) => {
            const sourceId = linkEndpointId(d.source);
            const targetId = linkEndpointId(d.target);
            if (sourceId === graph.focusId || targetId === graph.focusId) {
              return orbitRadius * 0.92;
            }
            return orbitRadius * 0.7;
          })
          .strength(0.34),
      )
      .force("charge", d3.forceManyBody().strength(-460))
      .force(
        "x",
        d3
          .forceX((typed: GraphNode) => {
            if (typed.id === graph.focusId) {
              return centerX;
            }
            const angle = angleById.get(typed.id) ?? 0;
            return centerX + Math.cos(angle) * orbitRadius;
          })
          .strength(0.12),
      )
      .force(
        "y",
        d3
          .forceY((typed: GraphNode) => {
            if (typed.id === graph.focusId) {
              return centerY;
            }
            const angle = angleById.get(typed.id) ?? 0;
            return centerY + Math.sin(angle) * orbitRadius;
          })
          .strength(0.12),
      )
      .force("center", d3.forceCenter(centerX, centerY))
      .force("collide", d3.forceCollide<GraphNode>().radius((d: GraphNode) => 22 + d.volume * 0.1));

    const links = linkLayer
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(graph.links)
      .enter()
      .append("line")
      .attr("stroke", (d: GraphLink) => {
        const sourceId = linkEndpointId(d.source);
        const targetId = linkEndpointId(d.target);
        return sourceId === graph.focusId || targetId === graph.focusId
          ? "#3b82f6"
          : "#3f3f46";
      })
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.85);

    const linkLabels = labelLayer
      .selectAll<SVGGElement, GraphLink>("g")
      .data(graph.links)
      .enter()
      .append("g")
      .style("pointer-events", "none");

    linkLabels
      .append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", "rgba(9,9,11,0.84)")
      .attr("stroke", "rgba(63,63,70,0.85)")
      .attr("width", (d: GraphLink) => Math.max(28, d.relation.length * 6))
      .attr("height", 12)
      .attr("x", (d: GraphLink) => -(Math.max(28, d.relation.length * 6) / 2))
      .attr("y", -8);

    linkLabels
      .append("text")
      .text((d: GraphLink) => d.relation)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .attr("y", 1);

    const nodes = nodeLayer
      .selectAll<SVGGElement, GraphNode>("g")
      .data(graph.nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("click", (_event: MouseEvent, node: GraphNode) => {
        setPivot(node.id);
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            d.fx = clamp(event.x, 20, width - 20);
            d.fy = clamp(event.y, 20, height - 20);
          })
          .on("end", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    nodes
      .append("circle")
      .attr("r", (d: GraphNode) => 11 + d.volume * 0.09)
      .attr("fill", "rgba(9,9,11,0.75)")
      .attr("stroke", (d: GraphNode) => riskColor(d.risk))
      .attr("stroke-width", (d: GraphNode) => (d.id === graph.focusId ? 3 : 2));

    nodes
      .append("circle")
      .attr("r", (d: GraphNode) => 7 + d.volume * 0.05)
      .attr("fill", (d: GraphNode) => riskColor(d.risk))
      .attr("fill-opacity", (d: GraphNode) => (d.id === graph.focusId ? 0.95 : 0.74))
      .attr("stroke", "#09090b")
      .attr("stroke-width", 1.2);

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 3)
      .attr("fill", "#09090b")
      .attr("font-size", 8)
      .attr("font-weight", 800)
      .text((d: GraphNode) => d.type.toUpperCase().slice(0, 3));

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d: GraphNode) => 18 + d.volume * 0.09)
      .attr("fill", "#cbd5e1")
      .attr("font-size", 9)
      .attr("font-weight", 700)
      .text((d: GraphNode) => d.label.slice(0, 18));

    nodes
      .append("title")
      .text((d: GraphNode) => `${d.label}\nRisk: ${d.risk}\nVolume: ${d.volume}`);

    simulation.alpha(0.82).restart();

    simulation.on("tick", () => {
      graph.nodes.forEach((node) => {
        node.x = clamp(node.x ?? centerX, 20, width - 20);
        node.y = clamp(node.y ?? centerY, 20, height - 20);
      });

      links
        .attr("x1", (d: GraphLink) => linkEndpointX(d.source))
        .attr("y1", (d: GraphLink) => linkEndpointY(d.source))
        .attr("x2", (d: GraphLink) => linkEndpointX(d.target))
        .attr("y2", (d: GraphLink) => linkEndpointY(d.target));

      linkLabels
        .attr("transform", (d: GraphLink) => {
          const x = (linkEndpointX(d.source) + linkEndpointX(d.target)) / 2;
          const y = (linkEndpointY(d.source) + linkEndpointY(d.target)) / 2;
          return `translate(${x}, ${y})`;
        });

      nodes.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [dimensions.height, dimensions.width, graph]);

  const pivotLabel = pivot
    ? graph?.nodes.find((node) => node.id === pivot)?.label ?? "Selected Node"
    : "Transaction";

  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-2xl border border-zinc-800 bg-black/85 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Entity Link Graph</h3>
        </div>
        <p className="text-[10px] font-mono text-zinc-500">click node to pivot & recenter</p>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
        {transaction ? (
          <svg ref={svgRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">Select a transaction to render the entity graph.</div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-3 font-mono text-[10px] text-zinc-400">
          <LegendDot color="bg-emerald-400" label="safe" />
          <LegendDot color="bg-amber-400" label="amber" />
          <LegendDot color="bg-red-400" label="threat" />
        </div>

        <button
          type="button"
          onClick={() => {
            if (transaction) {
              setPivot(`txn:${transaction.id}`);
            }
          }}
          className={cn(
            "absolute bottom-2 right-2 rounded-md border px-2 py-1 font-mono text-[10px]",
            "border-zinc-700 bg-zinc-900/85 text-zinc-300 hover:border-primary/40 hover:text-zinc-100",
          )}
        >
          pivot: {pivotLabel}
        </button>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span>{label}</span>
    </span>
  );
}

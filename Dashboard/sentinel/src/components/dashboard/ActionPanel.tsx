import { useEffect, useMemo, useState } from "react";
import { Ban, Clock3, Gavel, MessageSquareText, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Transaction } from "@/lib/fraud-mock";
import { formatINR } from "@/lib/fraud-mock";
import { cn } from "@/lib/utils";

interface ActionPanelProps {
  transaction: Transaction | null;
  flaggedTransactions: Transaction[];
  apiUrl: string;
  onAction: (type: "override" | "blacklist" | "rule", target: string) => void;
  onCaseAction: (
    action: "flag" | "escalate" | "dismiss" | "note",
    transaction: Transaction,
    note?: string,
  ) => Promise<void>;
}

interface TrailEntry {
  action: "flag" | "escalate" | "dismiss" | "note";
  timestamp: number;
  note?: string;
}

function riskBadge(score: number) {
  if (score > 75) return "border-red-500/50 bg-red-500/20 text-red-300";
  if (score >= 40) return "border-amber-500/50 bg-amber-500/20 text-amber-300";
  return "border-emerald-500/50 bg-emerald-500/20 text-emerald-300";
}

function elapsedSince(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ActionPanel({
  transaction,
  flaggedTransactions,
  apiUrl,
  onAction,
  onCaseAction,
}: ActionPanelProps) {
  const target = transaction?.upiId ?? "—";
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [noteCaseId, setNoteCaseId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [closedCaseIds, setClosedCaseIds] = useState<string[]>([]);
  const [trailByCase, setTrailByCase] = useState<Record<string, TrailEntry[]>>({});

  const caseQueue = useMemo(
    () =>
      [...flaggedTransactions]
        .filter((item) => !closedCaseIds.includes(item.id))
        .sort((a, b) => b.riskScore - a.riskScore),
    [closedCaseIds, flaggedTransactions],
  );

  const resolvedCases = useMemo(
    () => flaggedTransactions.filter((item) => closedCaseIds.includes(item.id)),
    [closedCaseIds, flaggedTransactions],
  );

  useEffect(() => {
    if (!caseQueue.length) {
      setActiveCaseId(null);
      return;
    }

    if (!activeCaseId || !caseQueue.some((item) => item.id === activeCaseId)) {
      setActiveCaseId(caseQueue[0].id);
    }
  }, [activeCaseId, caseQueue]);

  const executeCaseAction = async (
    action: "flag" | "escalate" | "dismiss" | "note",
    selectedCase: Transaction,
    note?: string,
  ) => {
    await onCaseAction(action, selectedCase, note);

    setTrailByCase((prev) => ({
      ...prev,
      [selectedCase.id]: [
        { action, timestamp: Date.now(), note },
        ...(prev[selectedCase.id] ?? []),
      ].slice(0, 5),
    }));

    if (action === "dismiss" || action === "escalate" || action === "flag") {
      setClosedCaseIds((prev) => [...new Set([...prev, selectedCase.id])]);
    }

    if (action === "note") {
      setNoteCaseId(null);
      setDraftNote("");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement | null;
      if (targetElement) {
        const tag = targetElement.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") {
          return;
        }
      }

      if (!activeCaseId) {
        return;
      }

      const selectedCase = caseQueue.find((item) => item.id === activeCaseId);
      if (!selectedCase) {
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void executeCaseAction("flag", selectedCase);
      }
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        void executeCaseAction("escalate", selectedCase);
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        void executeCaseAction("dismiss", selectedCase);
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNoteCaseId(selectedCase.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCaseId, caseQueue]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Analyst Action Panel</h2>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-md border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ML API Endpoint</p>
          <p className="mt-2 truncate rounded-md border border-border bg-secondary/50 px-2 py-1.5 font-mono text-[11px] text-foreground">
            {apiUrl}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Fraud prediction requests are pinned to this host for your live demo.
          </p>
        </div>

        <div className="rounded-md border border-border bg-background/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p>
          <p className="truncate font-mono text-xs font-semibold text-foreground">{target}</p>
        </div>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-safe/40 text-safe hover:bg-safe/10 hover:text-safe"
          disabled={!transaction}
          onClick={() => {
            onAction("override", target);
            toast.success("Transaction marked as Safe", {
              description: `Manual override applied to ${target}`,
            });
          }}
        >
          <ShieldCheck className="h-4 w-4" />
          Manual Override (Mark as Safe)
        </Button>

        <Button
          className="w-full justify-start gap-2 bg-danger text-danger-foreground hover:bg-danger/90"
          disabled={!transaction}
          onClick={() => {
            onAction("blacklist", target);
            toast.error("UPI ID added to blacklist", {
              description: `${target} will now block all future transactions.`,
            });
          }}
        >
          <Ban className="h-4 w-4" />
          Blacklist UPI ID
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={!transaction}
          onClick={() => {
            onAction("rule", target);
            toast("Detection rule generated", {
              description: `RULE_${Math.floor(Math.random() * 9999)} pushed to fraud engine.`,
              icon: <Sparkles className="h-4 w-4 text-primary" />,
            });
          }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Generate Detection Rule
        </Button>

        <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
          All actions are logged to the <span className="font-mono text-foreground">audit_trail</span>{" "}
          stream and require Tier-2 approval before propagating to production.
        </p>

        <div className="mt-4 rounded-lg border border-border bg-background/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-[0.12em] text-foreground">Case Management</h3>
            </div>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
              {caseQueue.length} queued
            </span>
          </div>

          <div className="space-y-2">
            {caseQueue.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No active flagged cases.</p>
            )}

            {caseQueue.map((item) => {
              const isActive = activeCaseId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-md border border-border bg-background/50 p-2",
                    isActive && "border-primary/60 ring-1 ring-primary/30",
                  )}
                  onClick={() => setActiveCaseId(item.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-foreground">{item.id}</p>
                      <p className="text-[10px] text-muted-foreground">{formatINR(item.amount)} · {elapsedSince(item.timestamp)} ago</p>
                    </div>
                    <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[10px]", riskBadge(item.riskScore))}>
                      {Math.round(item.riskScore)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        void executeCaseAction("flag", item);
                      }}
                    >
                      Flag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-500/40 text-[10px] text-amber-300"
                      onClick={() => {
                        void executeCaseAction("escalate", item);
                      }}
                    >
                      Escalate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        void executeCaseAction("dismiss", item);
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[10px]"
                      onClick={() => setNoteCaseId(item.id)}
                    >
                      <MessageSquareText className="h-3 w-3" />
                      Note
                    </Button>
                  </div>

                  {noteCaseId === item.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={draftNote}
                        onChange={(event) => setDraftNote(event.target.value)}
                        placeholder="Add case note"
                        className="h-7 text-[11px]"
                      />
                      <Button
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          void executeCaseAction("note", item, draftNote.trim());
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {resolvedCases.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Resolved Cases
              </h4>
              {resolvedCases.slice(0, 4).map((item) => (
                <div key={`resolved-${item.id}`} className="rounded-md border border-border bg-background/40 p-2">
                  <p className="font-mono text-[10px] text-foreground">{item.id}</p>
                  <div className="mt-1 space-y-1">
                    {(trailByCase[item.id] ?? []).map((trail, index) => (
                      <p key={`${trail.action}-${index}`} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="uppercase">{trail.action}{trail.note ? `: ${trail.note}` : ""}</span>
                        <span className="font-mono"><Clock3 className="mr-1 inline h-2.5 w-2.5" />{new Date(trail.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

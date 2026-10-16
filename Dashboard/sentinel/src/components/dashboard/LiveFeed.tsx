import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Download,
  Filter,
  Flag,
  Radio,
  ShieldAlert,
  StickyNote,
  X,
} from "lucide-react";
import type { Transaction } from "@/lib/fraud-mock";
import { formatINR, formatTime } from "@/lib/fraud-mock";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type FeedViewMode = "all" | "alerts";
type StatusFilter = "all" | "verified" | "flagged" | "analyzing";
type RiskFilter = "all" | "low" | "medium" | "high";
type TimeWindowFilter = "1h" | "6h" | "24h";
type QuickAction = "flag" | "dismiss" | "escalate" | "note";

interface LiveFeedProps {
  transactions: Transaction[];
  selectedId: string | null;
  expandedId: string | null;
  selectedIds: string[];
  highRiskSessionCount: number;
  noteFocusTxnId: string | null;
  escapeSignal: number;
  onSelect: (t: Transaction) => void;
  onToggleExpand: (transactionId: string) => void;
  onToggleSelect: (transactionId: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onBulkAction: (action: "dismiss" | "escalate", ids: string[]) => void;
  onExportSelected: (ids: string[]) => void;
  onQuickAction: (action: QuickAction, transaction: Transaction, note?: string) => Promise<void> | void;
  onConsumeNoteFocus: () => void;
}

function riskBadgeClass(score: number): string {
  if (score > 75) {
    return "border-red-500/50 bg-red-500/20 text-red-300";
  }

  if (score >= 40) {
    return "border-amber-500/50 bg-amber-500/20 text-amber-300";
  }

  return "border-emerald-500/50 bg-emerald-500/20 text-emerald-300";
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

function transactionStatus(transaction: Transaction): "verified" | "flagged" | "analyzing" {
  if (transaction.risk === "High") {
    return "flagged";
  }
  if (transaction.risk === "Low") {
    return "verified";
  }
  return "analyzing";
}

function transactionMeta(transaction: Transaction) {
  const seed = hashString(transaction.id);
  const txnTypes = ["P2P Transfer", "Merchant Payment", "Collect Request", "Wallet Load"];
  const merchants = ["FastKart", "Urban Grocer", "Nova Recharge", "PayLink Hub", "TruMart"];
  const channels = ["UPI", "IMPS", "NEFT", "Wallet"];
  const octetA = 10 + (seed % 240);
  const octetB = 5 + (Math.floor(seed / 7) % 240);
  const octetC = 20 + (Math.floor(seed / 13) % 220);
  const octetD = 2 + (Math.floor(seed / 17) % 230);

  return {
    type: txnTypes[seed % txnTypes.length] ?? "P2P Transfer",
    deviceFingerprint: `dfp_${transaction.id.slice(-6)}_${(seed % 4096).toString(16).toUpperCase()}`,
    ipAddress: `${octetA}.${octetB}.${octetC}.${octetD}`,
    merchant: merchants[Math.floor(seed / 3) % merchants.length] ?? "TruMart",
    channel: channels[Math.floor(seed / 5) % channels.length] ?? "UPI",
  };
}

function topShapDrivers(transaction: Transaction): Array<{ label: string; value: number }> {
  const f = transaction.features;
  const candidates = [
    { label: "Blacklist Match", value: f.recipientBlacklisted ? 0.96 : 0.06 },
    { label: "Amount Anomaly", value: f.amountAnomaly },
    { label: "Behavior Drift", value: f.behavioralAnomaly },
    { label: "Velocity", value: f.velocityScore },
    { label: "VPN/Proxy", value: f.vpnDetected ? 0.88 : 0.12 },
    { label: "Location Mismatch", value: f.locationMismatch ? 0.84 : 0.1 },
    { label: "Device Trust", value: 1 - f.deviceTrust },
  ];

  return candidates
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => ({ ...entry, value: Number(entry.value.toFixed(3)) }));
}

export function LiveFeed({
  transactions,
  selectedId,
  expandedId,
  selectedIds,
  highRiskSessionCount,
  noteFocusTxnId,
  escapeSignal,
  onSelect,
  onToggleExpand,
  onToggleSelect,
  onToggleSelectAll,
  onBulkAction,
  onExportSelected,
  onQuickAction,
  onConsumeNoteFocus,
}: LiveFeedProps) {
  const [pulseAlerts, setPulseAlerts] = useState(false);
  const previousAlertCountRef = useRef(highRiskSessionCount);

  const [viewMode, setViewMode] = useState<FeedViewMode>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>("24h");
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 1]);

  const [openActionsForId, setOpenActionsForId] = useState<string | null>(null);
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [dismissAnimatingIds, setDismissAnimatingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (highRiskSessionCount > previousAlertCountRef.current) {
      setPulseAlerts(true);
      const timeoutId = window.setTimeout(() => setPulseAlerts(false), 900);
      previousAlertCountRef.current = highRiskSessionCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousAlertCountRef.current = highRiskSessionCount;
    return undefined;
  }, [highRiskSessionCount]);

  const [amountMin, amountMax] = useMemo(() => {
    if (transactions.length === 0) {
      return [0, 10000];
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const transaction of transactions) {
      min = Math.min(min, transaction.amount);
      max = Math.max(max, transaction.amount);
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 10000];
    }

    if (min === max) {
      return [Math.max(0, min - 1000), max + 1000];
    }

    return [min, max];
  }, [transactions]);

  useEffect(() => {
    setAmountRange((previous) => {
      const nextMin = Math.max(amountMin, Math.min(previous[0] ?? amountMin, amountMax));
      const nextMax = Math.max(nextMin, Math.min(previous[1] ?? amountMax, amountMax));

      if (previous[0] === 0 && previous[1] === 1) {
        return [amountMin, amountMax];
      }

      return [nextMin, nextMax];
    });
  }, [amountMin, amountMax]);

  useEffect(() => {
    if (!noteFocusTxnId) {
      return;
    }
    setOpenActionsForId(noteFocusTxnId);
    onConsumeNoteFocus();
  }, [noteFocusTxnId, onConsumeNoteFocus]);

  useEffect(() => {
    setOpenActionsForId(null);
    setFiltersOpen(false);
  }, [escapeSignal]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const transactionsVisibleByState = useMemo(() => {
    return transactions.filter((transaction) => !hiddenIds.has(transaction.id));
  }, [hiddenIds, transactions]);

  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    const windowMs =
      timeWindow === "1h" ? 60 * 60 * 1000 : timeWindow === "6h" ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    return transactionsVisibleByState.filter((transaction) => {
      if (viewMode === "alerts" && transaction.riskScore <= 75) {
        return false;
      }

      const txStatus = transactionStatus(transaction);
      if (statusFilter !== "all" && txStatus !== statusFilter) {
        return false;
      }

      if (riskFilter === "high" && transaction.riskScore <= 75) {
        return false;
      }
      if (riskFilter === "medium" && (transaction.riskScore < 40 || transaction.riskScore > 75)) {
        return false;
      }
      if (riskFilter === "low" && transaction.riskScore >= 40) {
        return false;
      }

      if (transaction.amount < amountRange[0] || transaction.amount > amountRange[1]) {
        return false;
      }

      if (now - transaction.timestamp > windowMs) {
        return false;
      }

      return true;
    });
  }, [amountRange, riskFilter, statusFilter, timeWindow, transactionsVisibleByState, viewMode]);

  const visibleIds = useMemo(() => filteredTransactions.map((transaction) => transaction.id), [filteredTransactions]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((transactionId) => selectedSet.has(transactionId));

  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((transactionId) => selectedSet.has(transactionId)),
    [selectedSet, visibleIds],
  );

  const filtersActive =
    statusFilter !== "all" ||
    riskFilter !== "all" ||
    timeWindow !== "24h" ||
    amountRange[0] > amountMin ||
    amountRange[1] < amountMax;

  const filterRenderKey = `${viewMode}-${statusFilter}-${riskFilter}-${timeWindow}-${amountRange[0]}-${amountRange[1]}`;

  const resetFilters = () => {
    setStatusFilter("all");
    setRiskFilter("all");
    setTimeWindow("24h");
    setAmountRange([amountMin, amountMax]);
  };

  const handleQuickAction = async (action: QuickAction, transaction: Transaction) => {
    if (action === "dismiss") {
      setDismissAnimatingIds((previous) => new Set(previous).add(transaction.id));
      window.setTimeout(() => {
        setHiddenIds((previous) => new Set(previous).add(transaction.id));
      }, 1500);
    }

    await onQuickAction(action, transaction);
    setOpenActionsForId(null);
  };

  const handleAddNote = async (transaction: Transaction) => {
    const note = (noteDraftById[transaction.id] ?? "").trim();
    if (!note) {
      return;
    }

    await onQuickAction("note", transaction, note);
    setNoteDraftById((previous) => ({ ...previous, [transaction.id]: "" }));
    setOpenActionsForId(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked, visibleIds)}
                className="h-3 w-3 accent-primary"
                aria-label="Select all visible transactions"
              />
              all
            </label>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                "border-red-500/40 bg-red-500/10 text-red-300",
                pulseAlerts && "animate-pulse",
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              alerts {highRiskSessionCount}
            </span>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
              >
                Filters Active
                <X className="h-3 w-3" />
              </button>
            )}
            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              22 features
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border bg-background/70 p-1">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-colors",
                viewMode === "all" ? "bg-primary/20 text-primary" : "text-zinc-400 hover:bg-zinc-800/60",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setViewMode("alerts")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-colors",
                viewMode === "alerts" ? "bg-red-500/20 text-red-300" : "text-zinc-400 hover:bg-zinc-800/60",
              )}
            >
              Alerts
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFiltersOpen((previous) => !previous)}
            className="h-7 gap-1 text-[10px]"
          >
            <Filter className="h-3 w-3" />
            {filtersOpen ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>

        <div
          className={cn(
            "mt-2 overflow-hidden transition-all duration-300",
            filtersOpen ? "max-h-44 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/55 p-2 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Status</p>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900 text-[11px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Risk Level</p>
              <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as RiskFilter)}>
                <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900 text-[11px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Amount Range</p>
                <span className="font-mono text-[10px] text-zinc-400">
                  {formatINR(amountRange[0])} - {formatINR(amountRange[1])}
                </span>
              </div>
              <Slider
                min={amountMin}
                max={amountMax}
                step={100}
                value={amountRange}
                onValueChange={(value) => {
                  const minValue = Math.min(value[0] ?? amountMin, value[1] ?? amountMax);
                  const maxValue = Math.max(value[0] ?? amountMin, value[1] ?? amountMax);
                  setAmountRange([minValue, maxValue]);
                }}
                className="py-2"
              />
            </div>

            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Time Window</p>
              <Select value={timeWindow} onValueChange={(value) => setTimeWindow(value as TimeWindowFilter)}>
                <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900 text-[11px]">
                  <SelectValue placeholder="24h" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                  <SelectItem value="6h">Last 6 hours</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-[10px] uppercase tracking-[0.14em] text-zinc-300"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-b border-border bg-zinc-950/70 transition-all duration-300",
          selectedVisibleIds.length > 0 ? "max-h-20 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-mono font-semibold text-primary">
            {selectedVisibleIds.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-amber-500/40 text-[10px] text-amber-300 hover:bg-amber-500/10"
            onClick={() => onBulkAction("escalate", selectedVisibleIds)}
          >
            <ShieldAlert className="h-3 w-3" />
            Bulk Escalate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[10px]"
            onClick={() => onBulkAction("dismiss", selectedVisibleIds)}
          >
            <CheckSquare className="h-3 w-3" />
            Bulk Dismiss
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[10px]"
            onClick={() => onExportSelected(selectedVisibleIds)}
          >
            <Download className="h-3 w-3" />
            Bulk Export CSV
          </Button>
        </div>
      </div>

      <div className="custom-scroll flex-1 min-h-0 overflow-y-auto p-2">
        {filteredTransactions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No transactions match current filters.</p>
        ) : (
          <ul key={filterRenderKey} className="space-y-2 animate-fade-in-up">
            {filteredTransactions.map((transaction) => {
              const isSelected = transaction.id === selectedId;
              const isExpanded = transaction.id === expandedId;
              const isDismissing = dismissAnimatingIds.has(transaction.id);
              const status = transactionStatus(transaction);
              const statusLabel =
                status === "flagged" ? "Fraud Alert" : status === "verified" ? "Verified" : "Analyzing";
              const statusClass =
                status === "flagged"
                  ? "bg-danger/15 text-danger border-danger/40"
                  : status === "verified"
                    ? "bg-safe/15 text-safe border-safe/40"
                    : "bg-warn/15 text-warn border-warn/40";

              const meta = transactionMeta(transaction);
              const drivers = topShapDrivers(transaction);

              return (
                <li key={transaction.id}>
                  <div
                    className={cn(
                      "w-full rounded-md border bg-background/40 px-3 py-2.5 text-left transition-all duration-200",
                      "hover:border-primary/50 hover:bg-secondary/40",
                      isSelected ? "border-primary/70 bg-secondary/60 ring-1 ring-primary/30" : "border-border",
                      isExpanded && "border-primary/60 bg-zinc-900/60",
                      isDismissing && "line-through opacity-30 transition-all duration-[1500ms]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="mt-0.5" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(transaction.id)}
                          onChange={(event) => onToggleSelect(transaction.id, event.target.checked)}
                          className="h-3.5 w-3.5 accent-primary"
                          aria-label={`Select transaction ${transaction.id}`}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          onSelect(transaction);
                          onToggleExpand(transaction.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-mono text-xs text-foreground">{transaction.upiId}</p>
                        {transaction.risk === "High" && transaction.scamType && (
                          <p className="mt-0.5 text-[10px] font-medium text-danger/90 animate-fade-in-up">
                            {transaction.scamType}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono font-semibold text-foreground">{formatINR(transaction.amount)}</span>
                          <span>·</span>
                          <span className="font-mono">{formatTime(transaction.timestamp)}</span>
                        </div>
                      </button>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            statusClass,
                          )}
                        >
                          {statusLabel}
                        </span>
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                            riskBadgeClass(transaction.riskScore),
                          )}
                        >
                          Risk {Math.round(transaction.riskScore)}
                        </span>
                      </div>

                      <Popover
                        open={openActionsForId === transaction.id}
                        onOpenChange={(open) => setOpenActionsForId(open ? transaction.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-primary"
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Open actions for ${transaction.id}`}
                          >
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          className="w-56 border-zinc-700 bg-zinc-950 p-2 text-zinc-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="space-y-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-full justify-start gap-2 text-[11px]"
                              onClick={() => handleQuickAction("flag", transaction)}
                            >
                              <Flag className="h-3.5 w-3.5 text-red-400" />
                              Flag Case
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-full justify-start gap-2 text-[11px]"
                              onClick={() => handleQuickAction("escalate", transaction)}
                            >
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                              Escalate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-full justify-start gap-2 text-[11px]"
                              onClick={() => handleQuickAction("dismiss", transaction)}
                            >
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                              Dismiss
                            </Button>
                            <div className="mt-2 rounded-md border border-zinc-800 bg-black/20 p-2">
                              <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                                <StickyNote className="h-3 w-3" />
                                Add Note
                              </label>
                              <input
                                value={noteDraftById[transaction.id] ?? ""}
                                onChange={(event) =>
                                  setNoteDraftById((previous) => ({
                                    ...previous,
                                    [transaction.id]: event.target.value,
                                  }))
                                }
                                placeholder="Type note..."
                                className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[11px] outline-none focus:border-primary"
                              />
                              <Button
                                size="sm"
                                className="mt-2 h-7 w-full text-[11px]"
                                onClick={() => handleAddNote(transaction)}
                              >
                                Save Note
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/45 p-3">
                        <div className="grid gap-2 text-[11px] text-zinc-300 md:grid-cols-2">
                          <div>
                            <span className="text-zinc-500">Full UPI ID:</span> {transaction.upiId}
                          </div>
                          <div>
                            <span className="text-zinc-500">Transaction Type:</span> {meta.type}
                          </div>
                          <div>
                            <span className="text-zinc-500">Device Fingerprint:</span> {meta.deviceFingerprint}
                          </div>
                          <div>
                            <span className="text-zinc-500">IP Address:</span> {meta.ipAddress}
                          </div>
                          <div>
                            <span className="text-zinc-500">Merchant:</span> {meta.merchant}
                          </div>
                          <div>
                            <span className="text-zinc-500">Channel:</span> {meta.channel}
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            Top SHAP Drivers
                          </p>
                          <div className="space-y-2">
                            {drivers.map((driver) => (
                              <div key={`${transaction.id}-${driver.label}`} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-zinc-300">{driver.label}</span>
                                  <span className="font-mono text-zinc-400">{(driver.value * 100).toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 rounded bg-zinc-800">
                                  <div
                                    className="h-1.5 rounded bg-gradient-to-r from-red-500/70 to-amber-400/70"
                                    style={{ width: `${Math.min(100, Math.max(4, driver.value * 100))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

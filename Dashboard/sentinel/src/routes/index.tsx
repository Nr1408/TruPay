import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import { Header, type LiveFeedNotification } from "@/components/dashboard/Header";
import { LiveMetricsBar } from "@/components/dashboard/LiveMetricsBar";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { AttackFlowCanvas } from "@/components/dashboard/AttackFlowCanvas";
import { VelocityChartPanel } from "@/components/dashboard/VelocityChartPanel";
import { EntityLinkGraph } from "@/components/dashboard/EntityLinkGraph";
import { FeatureImportance } from "@/components/dashboard/FeatureImportance";
import { ActionPanel } from "@/components/dashboard/ActionPanel";
import { PatternLibrary } from "@/components/dashboard/PatternLibrary";
import { RuleEngine } from "@/components/dashboard/RuleEngine";
import { ScenarioSimulator } from "@/components/dashboard/ScenarioSimulator";
import { ModelHealthPanel } from "@/components/dashboard/ModelHealthPanel";
import { ShortcutOverlay } from "@/components/dashboard/ShortcutOverlay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFraudPrediction } from "@/hooks/useFraudPrediction";
import { cn } from "@/lib/utils";
import {
  type FlowState,
  generateTransaction,
  IDLE_FLOW,
  type RiskLevel,
  type Transaction,
  type TransactionFeatures,
} from "@/lib/fraud-mock";
import {
  fetchLatestTransaction,
  HEARTBEAT_URL,
  LATEST_TRANSACTION_URL,
  NETWORK_ERROR_TOAST_MESSAGE,
  SAMPLE_TRANSACTION_FEATURES,
  testApiConnection,
  type PredictionLabel,
  transactionToFeatureVector,
} from "@/lib/ml-api";
import { postAuditEvent } from "@/lib/dashboard-telemetry";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const MAX_FEED = 40;
const LATEST_POLL_INTERVAL_MS = 2000;
const ANALYST_ID = "tier2-fraud-analyst";
const METRICS_BAR_VISIBILITY_KEY = "trupay.metricsBarVisible";

type DetectionState = "idle" | "fraud" | "verified";
type DashboardTab = "actions" | "patterns" | "rules" | "simulate";
type BulkAction = "dismiss" | "escalate";
type QuickAction = "flag" | "escalate" | "dismiss" | "note";

interface DecisionSnapshot {
  id: string;
  verdict: "SAFE" | "FLAGGED" | "THREAT";
  riskScore: number;
  timestamp: number;
}

interface LatestNormalizedTransaction {
  transaction: Transaction;
  prediction: PredictionLabel | null;
  featuresVector: number[];
  fingerprint: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function toFiniteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value >= 0.5;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false;
    }
  }

  return false;
}

function parsePrediction(value: unknown): PredictionLabel | null {
  const prediction = Number(value);
  return prediction === 0 || prediction === 1 ? prediction : null;
}

function parseTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) {
      return asDate;
    }
  }

  return Date.now();
}

function parseNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.map((item) => Number(item));
  return parsed.every((item) => Number.isFinite(item)) ? parsed : null;
}

function fallbackFeatures(prediction: PredictionLabel | null): TransactionFeatures {
  if (prediction === 1) {
    return {
      recipientBlacklisted: true,
      amountAnomaly: 0.88,
      locationMismatch: true,
      vpnDetected: true,
      deviceTrust: 0.22,
      behavioralAnomaly: 0.91,
      newRecipient: true,
      hourOfDay: 2,
      velocityScore: 0.87,
      ipReputation: 0.21,
    };
  }

  return {
    recipientBlacklisted: false,
    amountAnomaly: 0.12,
    locationMismatch: false,
    vpnDetected: false,
    deviceTrust: 0.84,
    behavioralAnomaly: 0.16,
    newRecipient: false,
    hourOfDay: 14,
    velocityScore: 0.14,
    ipReputation: 0.88,
  };
}

function toTransactionFeatures(featuresVector: number[]): TransactionFeatures {
  return {
    recipientBlacklisted: toBoolean(featuresVector[0]),
    amountAnomaly: clamp(toFiniteNumber(featuresVector[1], 0), 0, 1),
    locationMismatch: toBoolean(featuresVector[2]),
    vpnDetected: toBoolean(featuresVector[3]),
    deviceTrust: clamp(toFiniteNumber(featuresVector[4], 0.5), 0, 1),
    behavioralAnomaly: clamp(toFiniteNumber(featuresVector[5], 0), 0, 1),
    newRecipient: toBoolean(featuresVector[6]),
    hourOfDay: Math.round(clamp(toFiniteNumber(featuresVector[7], 0), 0, 1) * 23),
    velocityScore: clamp(toFiniteNumber(featuresVector[8], 0), 0, 1),
    ipReputation: clamp(toFiniteNumber(featuresVector[9], 0.5), 0, 1),
  };
}

function extractLatestRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const root = payload as Record<string, unknown>;

  if (root.latest && typeof root.latest === "object" && !Array.isArray(root.latest)) {
    return root.latest as Record<string, unknown>;
  }

  if (
    root.transaction &&
    typeof root.transaction === "object" &&
    !Array.isArray(root.transaction)
  ) {
    return root.transaction as Record<string, unknown>;
  }

  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }

  return root;
}

function normalizeLatestTransaction(payload: unknown): LatestNormalizedTransaction | null {
  const record = extractLatestRecord(payload);
  if (!record) {
    return null;
  }

  const featuresVector =
    parseNumberArray(record.features) ??
    parseNumberArray(record.feature_vector) ??
    parseNumberArray(record.featureVector) ??
    parseNumberArray(record.input_features) ??
    [];

  const prediction = parsePrediction(
    record.prediction ?? record.label ?? record.result ?? record.class,
  );

  const amountFromFeatures =
    featuresVector.length > 10 ? clamp(toFiniteNumber(featuresVector[10], 0), 0, 1) * 100000 : 0;
  const amount = Math.max(
    0,
    Math.round(
      toFiniteNumber(
        record.amount ?? record.transaction_amount ?? record.transactionAmount,
        amountFromFeatures,
      ),
    ),
  );

  const timestamp = parseTimestamp(
    record.timestamp ?? record.ts ?? record.created_at ?? record.createdAt,
  );

  const upiId = String(
    record.upiId ??
      record.upi_id ??
      record.sender_upi ??
      record.receiver_upi ??
      record.payee_upi ??
      "mobile_transaction@upi",
  );

  const scoreFromFeatures =
    featuresVector.length > 11 ? clamp(toFiniteNumber(featuresVector[11], 0), 0, 1) * 100 : 0;
  const riskScore = Math.round(
    clamp(toFiniteNumber(record.riskScore ?? record.risk_score, scoreFromFeatures), 0, 100),
  );

  const risk: RiskLevel =
    prediction === 1
      ? "High"
      : prediction === 0
        ? "Low"
        : riskScore >= 70
          ? "High"
          : riskScore >= 40
            ? "Medium"
            : "Low";

  const id = String(
    record.id ??
      record.transaction_id ??
      record.txn_id ??
      `latest_${timestamp}_${Math.floor(amount)}_${upiId}`,
  );

  const scamType = String(record.scamType ?? record.type ?? record.status ?? "");

  const transaction: Transaction = {
    id,
    upiId,
    amount,
    timestamp,
    riskScore,
    risk,
    scamType,
    features:
      featuresVector.length >= 10
        ? toTransactionFeatures(featuresVector)
        : fallbackFeatures(prediction),
  };

  const fingerprint = `${id}|${timestamp}|${amount}|${prediction ?? "na"}`;

  return {
    transaction,
    prediction,
    featuresVector,
    fingerprint,
  };
}

const FRAUD_FLOW: FlowState = {
  start: "fail",
  blacklist: "fail",
  location: "fail",
  vpn: "fail",
  behavior: "fail",
  verdict: "fail",
};

const VERIFIED_FLOW: FlowState = {
  start: "pass",
  blacklist: "pass",
  location: "pass",
  vpn: "pass",
  behavior: "pass",
  verdict: "pass",
};

function withPrediction(transaction: Transaction, prediction: PredictionLabel): Transaction {
  return {
    ...transaction,
    risk: prediction === 1 ? "High" : "Low",
    riskScore: prediction === 1 ? Math.max(transaction.riskScore, 88) : Math.min(transaction.riskScore, 18),
    timestamp: Date.now(),
  };
}

function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState>(IDLE_FLOW);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [casesResolved, setCasesResolved] = useState(0);
  const [casesEscalated, setCasesEscalated] = useState(0);
  const [avgResponseSeconds, setAvgResponseSeconds] = useState(34);
  const [sessionStartTimestamp] = useState(() => Date.now());
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "live" | "reconnecting"
  >("checking");
  const [isPollingLatest, setIsPollingLatest] = useState(false);
  const [metricsBarVisible, setMetricsBarVisible] = useState(true);
  const [modelHealthOpen, setModelHealthOpen] = useState(false);
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([]);
  const [highRiskTxnIds, setHighRiskTxnIds] = useState<string[]>([]);
  const [decisionHistory, setDecisionHistory] = useState<DecisionSnapshot[]>([]);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [activeTab, setActiveTab] = useState<DashboardTab>("actions");
  const [noteFocusTxnId, setNoteFocusTxnId] = useState<string | null>(null);
  const [escapeSignal, setEscapeSignal] = useState(0);
  const [notifications, setNotifications] = useState<LiveFeedNotification[]>(() => {
    const now = Date.now();
    return [
      {
        id: "seed_1",
        title: "Model drift warning: behavioral cluster shifted",
        detail: "Drift index crossed 0.18 on biometric cohort.",
        level: "warning",
        timestamp: now - 90_000,
        read: false,
      },
      {
        id: "seed_2",
        title: "Blacklist sync completed",
        detail: "118 new payee handles ingested.",
        level: "info",
        timestamp: now - 6 * 60_000,
        read: false,
      },
      {
        id: "seed_3",
        title: "Escalation acknowledged",
        detail: "Tier 3 accepted escalated fraud case.",
        level: "success",
        timestamp: now - 13 * 60_000,
        read: true,
      },
    ];
  });
  const mockPredictionFlip = useRef<PredictionLabel>(0);
  const latestFingerprintRef = useRef<string | null>(null);
  const isLatestPollRunningRef = useRef(false);
  const { apiUrl, isPredicting, predict } = useFraudPrediction();

  useEffect(() => {
    const stored = window.localStorage.getItem(METRICS_BAR_VISIBILITY_KEY);
    if (stored !== null) {
      setMetricsBarVisible(stored === "1");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(METRICS_BAR_VISIBILITY_KEY, metricsBarVisible ? "1" : "0");
  }, [metricsBarVisible]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const pushNotification = useCallback(
    (level: LiveFeedNotification["level"], title: string, detail?: string) => {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          title,
          detail,
          level,
          timestamp: Date.now(),
          read: false,
        },
        ...prev,
      ].slice(0, 40));
    },
    [],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
  }, []);

  const appendDecision = useCallback((entry: DecisionSnapshot) => {
    setDecisionHistory((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  const appendDecisionBatch = useCallback((entries: DecisionSnapshot[]) => {
    setDecisionHistory((prev) => [...entries, ...prev].slice(0, 20));
  }, []);

  const getMockPrediction = useCallback((): PredictionLabel => {
    mockPredictionFlip.current = mockPredictionFlip.current === 1 ? 0 : 1;
    return mockPredictionFlip.current;
  }, []);

  const applyPrediction = useCallback(
    (transaction: Transaction, prediction: PredictionLabel) => {
      const enriched = withPrediction(transaction, prediction);
      const timestamp = Date.now();

      setSelected(enriched);
      setExpandedTxnId(enriched.id);
      setTransactions((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== transaction.id);
        return [enriched, ...withoutCurrent].slice(0, MAX_FEED);
      });
      setAnalyzedCount((count) => count + 1);
      appendDecision({
        id: enriched.id,
        verdict: prediction === 1 ? "THREAT" : "SAFE",
        riskScore: enriched.riskScore,
        timestamp,
      });

      if (prediction === 1) {
        setFlow(FRAUD_FLOW);
        setDetectionState("fraud");
        setHighRiskTxnIds((prev) => (prev.includes(enriched.id) ? prev : [enriched.id, ...prev]));
        pushNotification(
          "danger",
          `Threat detected for ${enriched.upiId}`,
          `Risk score ${Math.round(enriched.riskScore)} · amount Rs ${enriched.amount.toLocaleString("en-IN")}`,
        );
        return;
      }

      setFlow(VERIFIED_FLOW);
      setDetectionState("verified");
      setHighRiskTxnIds((prev) => prev.filter((itemId) => itemId !== enriched.id));
    },
    [appendDecision, pushNotification],
  );

  const runPrediction = useCallback(
    async (
      transaction: Transaction,
      featureVector?: number[],
      allowMockFallback = false,
    ) => {
      try {
        const features = featureVector ?? transactionToFeatureVector(transaction);
        const prediction = await predict(features, {
          id: transaction.id,
          upiId: transaction.upiId,
          amount: transaction.amount,
        });
        applyPrediction(transaction, prediction);
        setConnectionStatus("live");
      } catch (error) {
        console.error(error);
        setConnectionStatus("reconnecting");
        toast.error(NETWORK_ERROR_TOAST_MESSAGE);

        if (allowMockFallback) {
          applyPrediction(transaction, getMockPrediction());
        }
      }
    },
    [applyPrediction, getMockPrediction, predict],
  );

  const runConnectionTest = useCallback(async (showChecking = true) => {
    if (showChecking) {
      setConnectionStatus("checking");
    }

    try {
      await testApiConnection(HEARTBEAT_URL);
      setConnectionStatus("live");
    } catch (error) {
      console.error(error);
      setConnectionStatus("reconnecting");

      if (showChecking) {
        toast.error(NETWORK_ERROR_TOAST_MESSAGE);
      }
    }
  }, []);

  useEffect(() => {
    void runConnectionTest(true);
  }, [runConnectionTest]);

  useEffect(() => {
    const heartbeatId = window.setInterval(() => {
      void runConnectionTest(false);
    }, 10000);

    return () => {
      window.clearInterval(heartbeatId);
    };
  }, [runConnectionTest]);

  // Initial state is empty to ensure only real-time correct data is shown.
  useEffect(() => {
    setSelected(null);
    setFlow(IDLE_FLOW);
  }, []);

  const pollLatestTransaction = useCallback(async () => {
    if (isLatestPollRunningRef.current) {
      return;
    }

    isLatestPollRunningRef.current = true;
    setIsPollingLatest(true);

    try {
      const latestPayload = await fetchLatestTransaction(LATEST_TRANSACTION_URL);
      if (!latestPayload) {
        setConnectionStatus("live");
        return;
      }

      const normalizedLatest = normalizeLatestTransaction(latestPayload);
      if (!normalizedLatest || normalizedLatest.transaction.amount <= 0) {
        return;
      }

      if (normalizedLatest.fingerprint === latestFingerprintRef.current) {
        return;
      }

      latestFingerprintRef.current = normalizedLatest.fingerprint;

      if (normalizedLatest.prediction !== null) {
        applyPrediction(normalizedLatest.transaction, normalizedLatest.prediction);
      } else if (normalizedLatest.featuresVector.length === 22) {
        await runPrediction(
          normalizedLatest.transaction,
          normalizedLatest.featuresVector,
          true,
        );
      } else {
        applyPrediction(
          normalizedLatest.transaction,
          normalizedLatest.transaction.risk === "High" ? 1 : 0,
        );
      }

      setConnectionStatus("live");
    } catch (error) {
      console.error(error);
      setConnectionStatus("reconnecting");
    } finally {
      isLatestPollRunningRef.current = false;
      setIsPollingLatest(false);
    }
  }, [applyPrediction, runPrediction]);

  useEffect(() => {
    void pollLatestTransaction();

    const latestPollId = window.setInterval(() => {
      void pollLatestTransaction();
    }, LATEST_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(latestPollId);
    };
  }, [pollLatestTransaction]);

  const handleSelect = useCallback(
    (t: Transaction) => {
      setSelected(t);
    },
    [],
  );

  const handleSimulate = useCallback((
    customFeatures?: number[], 
    customUpiId?: string, 
    customAmount?: number
  ) => {
    const simulated = generateTransaction(true);
    if (customUpiId) simulated.upiId = customUpiId;
    if (customAmount) simulated.amount = customAmount;
    
    setSelected(simulated);
    void runPrediction(
      simulated, 
      customFeatures ?? SAMPLE_TRANSACTION_FEATURES, 
      true
    );
  }, [runPrediction]);

  const handleReset = useCallback(() => {
    setFlow(IDLE_FLOW);
    setDetectionState("idle");
  }, []);

  const logAudit = useCallback(
    async (action: string, transactionId: string, note?: string) => {
      await postAuditEvent({
        analyst_id: ANALYST_ID,
        action,
        transaction_id: transactionId,
        timestamp: new Date().toISOString(),
        note,
      });
    },
    [],
  );

  const updateTransactionById = useCallback(
    (transactionId: string, updater: (transaction: Transaction) => Transaction) => {
      setTransactions((prev) => prev.map((item) => (item.id === transactionId ? updater(item) : item)));
      setSelected((prev) => (prev && prev.id === transactionId ? updater(prev) : prev));
    },
    [],
  );

  const handleAction = useCallback(
    (type: "override" | "blacklist" | "rule", _target: string) => {
      if (!selected) return;

      if (type === "override") {
        const updated = {
          ...selected,
          risk: "Low" as RiskLevel,
          riskScore: 5,
        };
        setSelected(updated);
        setTransactions((prev) =>
          prev.map((t) => (t.id === selected.id ? updated : t)),
        );
        setFlow(VERIFIED_FLOW);
        setDetectionState("verified");
        appendDecision({
          id: selected.id,
          verdict: "SAFE",
          riskScore: updated.riskScore,
          timestamp: Date.now(),
        });
      } else if (type === "blacklist") {
        const updated = {
          ...selected,
          risk: "High" as RiskLevel,
          riskScore: 99,
        };
        setSelected(updated);
        setTransactions((prev) =>
          prev.map((t) => (t.id === selected.id ? updated : t)),
        );
        setFlow(FRAUD_FLOW);
        setDetectionState("fraud");
        setHighRiskTxnIds((prev) => (prev.includes(selected.id) ? prev : [selected.id, ...prev]));
        appendDecision({
          id: selected.id,
          verdict: "FLAGGED",
          riskScore: updated.riskScore,
          timestamp: Date.now(),
        });
      }
    },
    [appendDecision, selected],
  );

  const handleToggleSelect = useCallback((transactionId: string, checked: boolean) => {
    setSelectedTxnIds((prev) => {
      if (checked) {
        return prev.includes(transactionId) ? prev : [...prev, transactionId];
      }
      return prev.filter((id) => id !== transactionId);
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (checked: boolean, visibleIds: string[]) => {
      if (!visibleIds.length) {
        return;
      }

      if (!checked) {
        setSelectedTxnIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        return;
      }

      setSelectedTxnIds((prev) => [...new Set([...prev, ...visibleIds])]);
    },
    [],
  );

  const handleExportSelected = useCallback(
    (ids: string[]) => {
      const selectedRows = transactions.filter((item) => ids.includes(item.id));
      if (!selectedRows.length) {
        return;
      }

      const header = "transaction_id,upi_id,amount,risk_score,risk,timestamp";
      const rows = selectedRows.map(
        (item) =>
          `${item.id},${item.upiId},${item.amount},${item.riskScore},${item.risk},${new Date(item.timestamp).toISOString()}`,
      );

      const blob = new Blob([[header, ...rows].join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `selected-transactions-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selectedRows.length} selected transaction(s).`);
    },
    [transactions],
  );

  const handleBulkAction = useCallback(
    (action: BulkAction, ids: string[]) => {
      if (!ids.length) {
        return;
      }

      const actionMap: Record<BulkAction, string> = {
        dismiss: "BULK_DISMISS",
        escalate: "BULK_ESCALATE",
      };

      ids.forEach((transactionId) => {
        void logAudit(actionMap[action], transactionId);
      });

      if (action === "dismiss") {
        ids.forEach((transactionId) => {
          updateTransactionById(transactionId, (item) => ({
            ...item,
            risk: "Low",
            riskScore: Math.min(item.riskScore, 20),
          }));
        });
        setHighRiskTxnIds((prev) => prev.filter((itemId) => !ids.includes(itemId)));
        setCasesResolved((count) => count + ids.length);
      }

      if (action === "escalate") {
        ids.forEach((transactionId) => {
          updateTransactionById(transactionId, (item) => ({
            ...item,
            risk: "High",
            riskScore: Math.max(item.riskScore, 88),
          }));
        });
        setHighRiskTxnIds((prev) => [...new Set([...ids, ...prev])]);
        setCasesEscalated((count) => count + ids.length);
      }

      const verdict: DecisionSnapshot["verdict"] = action === "dismiss" ? "SAFE" : "FLAGGED";
      appendDecisionBatch(
        ids.map((transactionId) => ({
          id: transactionId,
          verdict,
          riskScore: action === "dismiss" ? 20 : 90,
          timestamp: Date.now(),
        })),
      );

      setSelectedTxnIds((prev) => prev.filter((transactionId) => !ids.includes(transactionId)));

      const verb = action === "dismiss" ? "dismissed" : "escalated";
      toast.success(`${ids.length} transactions ${verb}.`);
      pushNotification(
        action === "dismiss" ? "success" : "warning",
        `${ids.length} transactions ${verb}`,
        `Bulk action executed by ${ANALYST_ID}`,
      );
    },
    [appendDecisionBatch, logAudit, pushNotification, updateTransactionById],
  );

  const handleCaseAction = useCallback(
    async (action: QuickAction, transaction: Transaction, note?: string) => {
      const actionLabel = action.toUpperCase();
      await logAudit(actionLabel, transaction.id, note);

      const responseSeconds = Math.max(6, Math.round((Date.now() - transaction.timestamp) / 1000));
      setAvgResponseSeconds((prev) => Math.round(prev * 0.75 + responseSeconds * 0.25));

      if (action === "dismiss") {
        updateTransactionById(transaction.id, (item) => ({
          ...item,
          risk: "Low",
          riskScore: Math.min(item.riskScore, 12),
        }));
        setHighRiskTxnIds((prev) => prev.filter((itemId) => itemId !== transaction.id));
        appendDecision({
          id: transaction.id,
          verdict: "SAFE",
          riskScore: 12,
          timestamp: Date.now(),
        });
        setCasesResolved((count) => count + 1);
        toast.success("Transaction dismissed.");
        pushNotification("success", `Dismissed ${transaction.upiId}`, "Case moved to verified queue.");
      }

      if (action === "flag" || action === "escalate") {
        updateTransactionById(transaction.id, (item) => ({
          ...item,
          risk: "High",
          riskScore: Math.max(item.riskScore, action === "flag" ? 98 : 88),
        }));
        setHighRiskTxnIds((prev) => (prev.includes(transaction.id) ? prev : [transaction.id, ...prev]));
        appendDecision({
          id: transaction.id,
          verdict: "FLAGGED",
          riskScore: Math.max(transaction.riskScore, action === "flag" ? 98 : 88),
          timestamp: Date.now(),
        });
        if (action === "escalate") {
          setCasesEscalated((count) => count + 1);
        }
        toast.success(action === "escalate" ? "Case escalated." : "Case flagged.");
        pushNotification(
          action === "escalate" ? "warning" : "danger",
          `${action === "escalate" ? "Escalated" : "Flagged"} ${transaction.upiId}`,
          `Risk score set to ${Math.max(transaction.riskScore, action === "flag" ? 98 : 88)}.`,
        );
      }

      if (action === "note") {
        toast.success("Case note logged", {
          description: note ? note : "Note entry saved.",
        });
        pushNotification("info", `Note added for ${transaction.upiId}`, note || "Analyst note appended to audit log.");
      }
    },
    [appendDecision, logAudit, pushNotification, updateTransactionById],
  );

  const highRiskSessionCount = highRiskTxnIds.length;

  const flaggedTransactions = useMemo(
    () => transactions.filter((item) => item.risk === "High" || item.riskScore > 75),
    [transactions],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement | null;
      if (targetElement) {
        const tagName = targetElement.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") {
          return;
        }
      }

      if (event.key === "?") {
        event.preventDefault();
        setShortcutOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setShortcutOpen(false);
        setTransactionDetailOpen(false);
        setExpandedTxnId(null);
        setNoteFocusTxnId(null);
        setEscapeSignal((prev) => prev + 1);
        return;
      }

      if (!transactions.length) {
        return;
      }

      const currentIndex = selected
        ? transactions.findIndex((item) => item.id === selected.id)
        : -1;

      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        const nextIndex = currentIndex >= 0
          ? Math.min(transactions.length - 1, currentIndex + 1)
          : 0;
        setSelected(transactions[nextIndex]);
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        const nextIndex = currentIndex >= 0
          ? Math.max(0, currentIndex - 1)
          : 0;
        setSelected(transactions[nextIndex]);
      }

      if (event.key === "Enter" && selected) {
        event.preventDefault();
        setExpandedTxnId((prev) => (prev === selected.id ? null : selected.id));
      }

      if (event.key === " " && selected) {
        event.preventDefault();
        setTransactionDetailOpen((prev) => !prev);
      }

      const key = event.key.toLowerCase();

      if (key === "f" && selected) {
        event.preventDefault();
        void handleCaseAction("flag", selected);
      }

      if (key === "d" && selected) {
        event.preventDefault();
        void handleCaseAction("dismiss", selected);
      }

      if (key === "e" && selected) {
        event.preventDefault();
        void handleCaseAction("escalate", selected);
      }

      if (key === "n" && selected) {
        event.preventDefault();
        setExpandedTxnId(selected.id);
        setNoteFocusTxnId(selected.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleCaseAction, selected, transactions]);

  const dashboardStyle = useMemo(
    () => ({
      "--dashboard-top-offset": `${metricsBarVisible ? 88 : 44}px`,
    }) as CSSProperties,
    [metricsBarVisible],
  );

  return (
    <div className="dashboard-app bg-background text-foreground" style={dashboardStyle}>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          metricsBarVisible ? "h-11 opacity-100" : "h-0 opacity-0",
        )}
      >
        <LiveMetricsBar />
      </div>

      <Header
        analyzedCount={analyzedCount}
        casesResolved={casesResolved}
        casesEscalated={casesEscalated}
        avgResponseSeconds={avgResponseSeconds}
        sessionStartTimestamp={sessionStartTimestamp}
        connectionStatus={connectionStatus}
        isPollingLatest={isPollingLatest}
        metricsBarVisible={metricsBarVisible}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        escapeSignal={escapeSignal}
        onToggleMetricsBar={() => setMetricsBarVisible((prev) => !prev)}
        onRetryConnection={() => {
          void runConnectionTest();
        }}
        onOpenNotifications={markNotificationsRead}
      />

      <main className="flex-1 min-h-0 overflow-hidden px-2 py-2 lg:px-3">
        <div className="dashboard-main-grid">
          {/* Left — Live feed */}
          <section className="dashboard-col min-h-0">
            <LiveFeed
              transactions={transactions}
              selectedId={selected?.id ?? null}
              expandedId={expandedTxnId}
              selectedIds={selectedTxnIds}
              highRiskSessionCount={highRiskSessionCount}
              noteFocusTxnId={noteFocusTxnId}
              escapeSignal={escapeSignal}
              onSelect={handleSelect}
              onToggleExpand={(transactionId) =>
                setExpandedTxnId((prev) => (prev === transactionId ? null : transactionId))
              }
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onBulkAction={handleBulkAction}
              onExportSelected={handleExportSelected}
              onQuickAction={handleCaseAction}
              onConsumeNoteFocus={() => setNoteFocusTxnId(null)}
            />
          </section>

          {/* Center — Attack flow + analytics */}
          <section className="dashboard-col dashboard-center-col min-h-0">
            <div className="dashboard-panel min-h-125 h-125">
              <AttackFlowCanvas
                flow={flow}
                transaction={selected}
                detectionState={detectionState}
                decisionHistory={decisionHistory}
                isSimulating={isPredicting}
                onSimulate={handleSimulate}
                onReset={handleReset}
              />
            </div>

            <div className="dashboard-panel min-h-45 h-45">
              <VelocityChartPanel />
            </div>

            <div className="dashboard-entity-panel">
              <EntityLinkGraph transaction={selected} />
            </div>
          </section>

          {/* Right — Insights + actions */}
          <section className="dashboard-col dashboard-right-col space-y-3 pr-1 custom-scrollbar min-h-0">
            <FeatureImportance transaction={selected} />
            
            <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex border-b border-border">
                {(["actions", "patterns", "rules", "simulate"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 px-2 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors",
                      activeTab === tab 
                        ? "bg-primary/10 text-primary border-b-2 border-primary" 
                        : "text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === "actions" && (
                  <ActionPanel
                    transaction={selected}
                    flaggedTransactions={flaggedTransactions}
                    apiUrl={apiUrl}
                    onAction={handleAction}
                    onCaseAction={handleCaseAction}
                  />
                )}
                {activeTab === "patterns" && <PatternLibrary />}
                {activeTab === "rules" && <RuleEngine />}
                {activeTab === "simulate" && <ScenarioSimulator onSimulate={handleSimulate} />}
              </div>
            </div>

            <ModelHealthPanel
              isOpen={modelHealthOpen}
              onToggle={() => setModelHealthOpen((prev) => !prev)}
            />
          </section>
        </div>
      </main>

      <Dialog open={Boolean(selected) && transactionDetailOpen} onOpenChange={setTransactionDetailOpen}>
        <DialogContent className="max-w-xl border-zinc-700 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-[0.12em]">
              Transaction Detail
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 text-xs">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="font-mono">ID: {selected.id}</p>
                <p className="font-mono">UPI: {selected.upiId}</p>
                <p className="font-mono">Amount: Rs {selected.amount.toLocaleString("en-IN")}</p>
                <p className="font-mono">Risk Score: {selected.riskScore}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                {Object.entries(selected.features).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400">{key}</span>
                    <span className="font-mono text-zinc-200">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShortcutOverlay open={shortcutOpen} onOpenChange={setShortcutOpen} />
    </div>
  );
}

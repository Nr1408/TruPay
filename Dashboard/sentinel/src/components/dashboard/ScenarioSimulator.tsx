import { useMemo, useState } from "react";
import { PlayCircle, Plus, ShieldAlert, Smartphone, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateTransaction } from "@/lib/fraud-mock";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  name: string;
  description: string;
  features: number[];
  upiId: string;
  amount: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: "screen_share",
    name: "Screen Share Scam",
    description: "Triggers screen recording & app tampering flags.",
    upiId: "fraudster@upi",
    amount: 15500,
    // 22 features: f[21]=1 (screen recording), f[15]=1 (tamper)
    features: [0, 0.2, 0, 0, 0.9, 0.2, 0, 0.5, 0.1, 0.8, 0.15, 0.8, 1, 0, 0, 1, 0, 0, 0.1, 0.1, 0.1, 1]
  },
  {
    id: "kyc_expiry",
    name: "KYC Expiry Fraud",
    description: "Late night transaction to a new recipient with high amount.",
    upiId: "bank_kyc_verification@upi",
    amount: 49000,
    // f[7]=0.1 (late night), f[6]=1 (new), f[1]=0.9 (amount anomaly)
    features: [0, 0.9, 1, 0, 0.3, 0.8, 1, 0.1, 0.9, 0.2, 0.49, 0.7, 1, 1, 1, 0.8, 1, 1, 0.8, 0.6, 0.7, 1]
  },
  {
    id: "collect_request",
    name: "Fake Collect Request",
    description: "High-risk merchant category + behavioral anomalies.",
    upiId: "rewards_winner@okaxis",
    amount: 5000,
    // f[10]=0.9 (merchant risk), f[5]=0.9 (behavioral)
    features: [0, 0.4, 0, 0, 0.6, 0.9, 1, 0.5, 0.4, 0.5, 0.9, 0.5, 0, 0, 0, 0.8, 0, 0, 0.3, 0.4, 0.2, 0]
  },
  {
    id: "impersonation",
    name: "Army/Govt Impersonation",
    description: "Blacklisted recipient + location mismatch.",
    upiId: "army_canteen_payment@upi",
    amount: 12000,
    // f[0]=1 (blacklist), f[2]=1 (location)
    features: [1, 0.3, 1, 1, 0.2, 0.5, 1, 0.4, 0.8, 0.3, 0.12, 0.9, 1, 0, 1, 0.5, 1, 1, 0.7, 0.8, 0.9, 1]
  }
];

type RuleOperator = ">" | "<" | "=" | "contains";
type RuleJoiner = "AND" | "OR";

interface RuleCondition {
  id: string;
  feature: string;
  operator: RuleOperator;
  value: string;
  joiner: RuleJoiner;
}

interface SimulationResult {
  totalFlagged: number;
  truePositiveRate: number;
  falsePositiveRate: number;
  overlapWithMl: number;
}

const FEATURE_OPTIONS = [
  "amount",
  "riskScore",
  "upiId",
  "amountAnomaly",
  "behavioralAnomaly",
  "velocityScore",
  "ipReputation",
  "deviceTrust",
  "newRecipient",
  "vpnDetected",
  "locationMismatch",
  "recipientBlacklisted",
];

function featureValue(transaction: ReturnType<typeof generateTransaction>, feature: string): string | number {
  const f = transaction.features;
  const map: Record<string, string | number> = {
    amount: transaction.amount,
    riskScore: transaction.riskScore,
    upiId: transaction.upiId,
    amountAnomaly: f.amountAnomaly,
    behavioralAnomaly: f.behavioralAnomaly,
    velocityScore: f.velocityScore,
    ipReputation: f.ipReputation,
    deviceTrust: f.deviceTrust,
    newRecipient: Number(f.newRecipient),
    vpnDetected: Number(f.vpnDetected),
    locationMismatch: Number(f.locationMismatch),
    recipientBlacklisted: Number(f.recipientBlacklisted),
  };

  return map[feature] ?? 0;
}

function evaluateCondition(transaction: ReturnType<typeof generateTransaction>, condition: RuleCondition): boolean {
  const raw = featureValue(transaction, condition.feature);
  const rawValue = condition.value.trim();

  if (condition.operator === "contains") {
    return String(raw).toLowerCase().includes(rawValue.toLowerCase());
  }

  const left = Number(raw);
  const right = Number(rawValue);

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  if (condition.operator === ">") return left > right;
  if (condition.operator === "<") return left < right;
  return left === right;
}

function evaluateRule(transaction: ReturnType<typeof generateTransaction>, conditions: RuleCondition[]): boolean {
  if (!conditions.length) return false;

  let accumulator = evaluateCondition(transaction, conditions[0]);

  for (let i = 1; i < conditions.length; i += 1) {
    const current = evaluateCondition(transaction, conditions[i]);
    const joiner = conditions[i - 1].joiner;
    accumulator = joiner === "AND" ? accumulator && current : accumulator || current;
  }

  return accumulator;
}

export function ScenarioSimulator({ 
  onSimulate 
}: { 
  onSimulate: (features: number[], upiId: string, amount: number) => void 
}) {
  const [conditions, setConditions] = useState<RuleCondition[]>([
    {
      id: "cond-1",
      feature: "riskScore",
      operator: ">",
      value: "70",
      joiner: "AND",
    },
  ]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isDeployOpen, setIsDeployOpen] = useState(false);

  const dataset = useMemo(
    () => Array.from({ length: 10000 }, (_, index) => generateTransaction(index % 5 === 0)),
    [],
  );

  const updateCondition = (id: string, patch: Partial<RuleCondition>) => {
    setConditions((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      {
        id: `cond-${Date.now()}`,
        feature: "amountAnomaly",
        operator: ">",
        value: "0.7",
        joiner: "AND",
      },
    ]);
  };

  const runSimulation = () => {
    const outcomes = dataset.map((transaction) => {
      const ruleFlag = evaluateRule(transaction, conditions);
      const mlFlag = transaction.risk === "High";
      return { ruleFlag, mlFlag };
    });

    const totalFlagged = outcomes.filter((row) => row.ruleFlag).length;
    const truePositives = outcomes.filter((row) => row.ruleFlag && row.mlFlag).length;
    const falsePositives = outcomes.filter((row) => row.ruleFlag && !row.mlFlag).length;
    const totalFraud = outcomes.filter((row) => row.mlFlag).length;
    const totalSafe = outcomes.length - totalFraud;
    const mlFlags = outcomes.filter((row) => row.mlFlag).length;

    setResult({
      totalFlagged,
      truePositiveRate: totalFraud ? (truePositives / totalFraud) * 100 : 0,
      falsePositiveRate: totalSafe ? (falsePositives / totalSafe) * 100 : 0,
      overlapWithMl: mlFlags ? (truePositives / mlFlags) * 100 : 0,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PlayCircle className="h-4 w-4 text-danger" />
        <h2 className="text-sm font-semibold text-foreground">Fraud Scenario Simulator</h2>
      </div>
      
      <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">
        Select a pre-configured attack pattern to test the entire detection pipeline from AI to Mobile Alert.
      </p>

      <div className="space-y-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSimulate(s.features, s.upiId, s.amount)}
            className="w-full text-left rounded-lg border border-border bg-background/30 p-3 hover:border-danger/40 hover:bg-danger/5 transition-all group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3 w-3 text-muted-foreground group-hover:text-danger transition-colors" />
                <span className="text-[11px] font-bold text-foreground">{s.name}</span>
              </div>
              <Zap className="h-3 w-3 text-danger opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <p className="text-[10px] text-muted-foreground italic mb-2">
              {s.description}
            </p>
            
            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span>₹{s.amount.toLocaleString()}</span>
              <span>{s.upiId}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-background/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-foreground">Rule Builder</h3>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={addCondition}>
            <Plus className="h-3 w-3" />
            Add Condition
          </Button>
        </div>

        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="rounded-md border border-border bg-background/50 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">Condition {index + 1}</span>
                {index < conditions.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateCondition(condition.id, {
                        joiner: condition.joiner === "AND" ? "OR" : "AND",
                      })
                    }
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-foreground"
                  >
                    {condition.joiner}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1">
                <select
                  value={condition.feature}
                  onChange={(event) => updateCondition(condition.id, { feature: event.target.value })}
                  className="rounded border border-border bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-200"
                >
                  {FEATURE_OPTIONS.map((feature) => (
                    <option key={feature} value={feature}>
                      {feature}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(event) =>
                    updateCondition(condition.id, {
                      operator: event.target.value as RuleOperator,
                    })
                  }
                  className="rounded border border-border bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-200"
                >
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value="=">{"="}</option>
                  <option value="contains">contains</option>
                </select>

                <Input
                  value={condition.value}
                  onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                  className="col-span-2 h-7 text-[10px]"
                  placeholder="value"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button className="text-[10px]" onClick={runSimulation}>Simulate</Button>
          <Button
            variant="outline"
            className="text-[10px]"
            onClick={() => {
              toast.success("Rule draft saved");
            }}
          >
            Save Draft
          </Button>
          <Button variant="outline" className="text-[10px]" onClick={() => setIsDeployOpen(true)}>
            Deploy Live
          </Button>
        </div>

        {result && (
          <div className="mt-3 rounded-md border border-border bg-black/40 p-2 text-[10px]">
            <p className="font-mono text-zinc-200">Total Flagged: {result.totalFlagged.toLocaleString("en-IN")}</p>
            <p className="font-mono text-zinc-200">Estimated TPR: {result.truePositiveRate.toFixed(2)}%</p>
            <p className="font-mono text-zinc-200">Estimated FPR: {result.falsePositiveRate.toFixed(2)}%</p>
            <p className="font-mono text-zinc-200">Overlap with ML Flags: {result.overlapWithMl.toFixed(2)}%</p>
          </div>
        )}
      </div>
      
      <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
        <div className="flex items-center gap-2 text-danger mb-1">
          <ShieldAlert className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Demo Mode Active</span>
        </div>
        <p className="text-[9px] text-danger/80 leading-tight">
          Simulated transactions will bypass real mobile input and trigger the Sentinel Flow instantly.
        </p>
      </div>

      <Dialog open={isDeployOpen} onOpenChange={setIsDeployOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-[0.12em]">
              Confirm Rule Deployment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Deploy this rule to live traffic evaluation? This will start auditing decisions immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeployOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsDeployOpen(false);
                toast.success("Rule deployed to live evaluator");
              }}
            >
              Confirm Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

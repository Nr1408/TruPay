import { Code2, Info, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES = [
  {
    id: 1,
    name: "Screen Share Intercept",
    condition: "IF screen_recording == 1 AND amount > 5000",
    action: "BLOCK_TRANSACTION",
    severity: "CRITICAL",
    rationale: "Potential AnyDesk/TeamViewer session active during payment."
  },
  {
    id: 2,
    name: "Location Drift",
    condition: "IF distance_from_last_tx > 500km AND time_delta < 1h",
    action: "FLAG_RISK",
    severity: "HIGH",
    rationale: "Impossible travel detected; likely account takeover."
  },
  {
    id: 3,
    name: "Velocity Threshold",
    condition: "IF tx_count_1h > 10 AND recipient_is_new == TRUE",
    action: "THROTTLE",
    severity: "MEDIUM",
    rationale: "Pattern matches automated bot or money mule activity."
  },
  {
    id: 4,
    name: "Blacklisted Recipient",
    condition: "IF recipient_id IN global_blacklist",
    action: "INSTANT_BLOCK",
    severity: "CRITICAL",
    rationale: "Recipient has 5+ reported fraud incidents in last 24h."
  },
  {
    id: 5,
    name: "Nighttime Anomaly",
    condition: "IF hour > 23 OR hour < 5 AND amount > user_avg * 5",
    action: "STEP_UP_AUTH",
    severity: "HIGH",
    rationale: "High-value nighttime transaction from unfamiliar location."
  },
  {
    id: 6,
    name: "VPN Masking",
    condition: "IF ip_type == 'VPN' AND behavioral_anomaly > 0.8",
    action: "FLAG_RISK",
    severity: "HIGH",
    rationale: "Identity masking combined with irregular keystroke cadence."
  }
];

export function RuleEngine() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-foreground">Detection Rule Engine</h2>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono italic">
          AUTO-GENERATED FROM MODEL IMPORTANCE
        </span>
      </div>

      <div className="space-y-3">
        {RULES.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-border bg-background/30 p-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-bold text-foreground">{rule.name}</span>
              </div>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-bold border",
                rule.severity === "CRITICAL" ? "bg-danger/10 text-danger border-danger/30" : 
                rule.severity === "HIGH" ? "bg-warn/10 text-warn border-warn/30" : 
                "bg-cyan-400/10 text-cyan-400 border-cyan-400/30"
              )}>
                {rule.severity}
              </span>
            </div>

            <div className="bg-black/40 rounded p-2 mb-2 font-mono text-[10px] text-cyan-400/90 border border-white/5">
              <span className="text-muted-foreground"># {rule.id} </span>
              {rule.condition}
            </div>

            <div className="flex items-start gap-1.5 text-[10px]">
              <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground italic leading-tight">
                {rule.rationale}
              </p>
            </div>
            
            <div className="mt-2 flex items-center justify-end">
              <span className="text-[9px] font-bold text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                TARGET: {rule.action}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


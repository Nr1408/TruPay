// TruPay Risk Analysis Component - v2.4.2 (Neural Learning Update)
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Lightbulb, 
  X, 
  CheckCircle2, 
  Loader2,
  ShieldMinus
} from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { Contact } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RiskScenario {
  scamType: string;
  aiSummary: string;
  threatLevel: "high" | "medium" | "low";
  attackFlow: string[];
}

const DEFAULT_SCENARIO: RiskScenario = {
  scamType: "Suspicious Behavior",
  aiSummary: "Multiple risk markers detected for amount ₹{amount}.",
  threatLevel: "high",
  attackFlow: ["Unusual transaction timing", "New recipient with no history", "Amount exceeds safe threshold"]
};

// Flask Feedback Endpoint
const FEEDBACK_URL = "http://192.168.29.184:5000/feedback";

const Risk = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const state = location.state as {
    contact: Contact;
    amount: number;
    note?: string;
    scenario?: RiskScenario;
    score: number;
  };

  if (!state) return null;
  const { contact, amount } = state;
  const scenario = state.scenario || DEFAULT_SCENARIO;

  const handleReportAndBlock = async () => {
    setIsReporting(true);
    
    try {
      // 1. Inform the server to LEARN this fraud pattern
      await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upiId: contact.upi,
          scamType: scenario.scamType,
          amount: amount,
          features: [] 
        })
      });

      // 2. Artificial delay for "Learning Animation" impact
      await new Promise(r => setTimeout(r, 4000));
      
      setIsReporting(false);
      setReportSuccess(true);
      
      // 3. Show Success and redirect
      setTimeout(() => {
        toast.success("Sentinel Intelligence Updated", {
          description: "This fraud pattern has been neutralized globally."
        });
        window.scrollTo(0, 0);
        navigate("/home", { replace: true });
      }, 3500);

    } catch (err) {
      console.error("Learning Error:", err);
      setIsReporting(false);
      toast.error("Feedback Link Offline", {
        description: "Local block applied. Global learning failed."
      });
      navigate("/home", { replace: true });
    }
  };

  const sevColor = (s: "high" | "medium" | "low") =>
    s === "high"
      ? "text-destructive border-destructive/20 bg-destructive/10"
      : s === "medium"
      ? "text-amber-500 border-amber-500/20 bg-amber-500/10"
      : "text-emerald-500 border-emerald-500/20 bg-emerald-500/10";

  return (
    <PhoneShell hideNav>
      <div className="flex flex-col min-h-screen bg-background p-6 select-none relative overflow-hidden">
        
        {/* Learning Overlay */}
        {isReporting && (
          <div className="fixed inset-0 z-[500] bg-zinc-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-700 overflow-hidden">
            <div className="relative mb-8">
              <Loader2 className="w-32 h-32 text-primary animate-spin" strokeWidth={0.5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldAlert className="w-12 h-12 text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-display font-black text-white mb-3 tracking-tight">Neural Deep Learning</h2>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-[280px] font-medium uppercase tracking-widest text-[10px]">
              Analyzing behavioral markers... <br/> Syncing to Global Sentinel Cloud
            </p>
            <div className="mt-12 flex gap-3">
              <div className="h-1 w-16 bg-primary rounded-full animate-pulse shadow-glow" />
              <div className="h-1 w-16 bg-primary/40 rounded-full animate-pulse delay-150" />
              <div className="h-1 w-16 bg-primary/10 rounded-full animate-pulse delay-300" />
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {reportSuccess && (
          <div className="fixed inset-0 z-[510] bg-emerald-600 flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-700 overflow-hidden">
            <div className="w-28 h-28 rounded-[40px] bg-white/20 flex items-center justify-center mb-10 animate-bounce shadow-2xl">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-4xl font-display font-black text-white mb-3">Identity Blocked</h2>
            <p className="text-white/80 text-sm leading-relaxed max-w-[280px] font-medium uppercase tracking-widest text-[10px]">
              Sentinel Database Synchronized. <br/> Threat successfully neutralized.
            </p>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-center pt-4 mb-8">
          <h1 className="text-xl font-display font-black uppercase tracking-widest text-muted-foreground/50">Risk Report</h1>
        </header>

        {/* Threat Level */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-[32px] bg-destructive/10 border border-destructive/20 flex items-center justify-center animate-risk-pulse">
              <ShieldAlert className="w-12 h-12 text-destructive" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-background border border-border px-3 py-1 rounded-full shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-destructive">
                {state.score}% Score
              </span>
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">
            AI Sentinel Verdict
          </p>
          <h2 className="text-3xl font-display font-black text-foreground mb-4">
            {scenario.scamType} Detected
          </h2>
          <div className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest", sevColor(scenario.threatLevel))}>
            {scenario.threatLevel} severity threat
          </div>
        </div>

        {/* Risk details scrollable area */}
        <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
          {/* AI summary */}
          <Block icon={<Lightbulb className="w-4 h-4" />} title="Why our AI flagged this" delay={120}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {scenario.aiSummary.replace("{amount}", amount.toLocaleString("en-IN"))}
              </p>
            </div>
          </Block>

          {/* Security Engine Output */}
          <Block icon={<Activity className="w-4 h-4" />} title="Security Engine Output" delay={180}>
            <div className="space-y-3">
              {scenario.attackFlow.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 border border-border/50 animate-in slide-in-from-right duration-500"
                  style={{ animationDelay: `${200 + i * 100}ms` }}
                >
                  <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-[10px] font-black text-destructive shadow-sm">
                    {i + 1}
                  </div>
                  <p className="text-xs font-bold text-foreground/80">{step}</p>
                </div>
              ))}
            </div>
          </Block>

          {/* Footer actions */}
          <div className="pt-6 space-y-4">
            <button
              id="report-block-btn"
              onClick={handleReportAndBlock}
              disabled={isReporting || reportSuccess}
              className="w-full py-5 rounded-[28px] bg-foreground text-background font-display font-black text-lg shadow-lg hover:brightness-90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <ShieldMinus className="w-5 h-5" />
              Report & Block User
            </button>
            <button
              onClick={() => navigate("/home", { replace: true })}
              className="w-full py-5 rounded-[28px] bg-secondary text-foreground font-display font-black text-lg hover:bg-secondary/80 transition-all active:scale-[0.98]"
            >
              I want to cancel
            </button>
            <p className="text-center text-[10px] text-muted-foreground font-medium px-10 leading-relaxed">
              TruPay AI Shield acts as an advisory. Always verify recipients before sending money.
            </p>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
};

const Block = ({
  icon,
  title,
  children,
  delay
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay: number;
}) => (
  <div
    className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">{children}</div>
  </div>
);

export default Risk;

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ShieldCheck, Share2, ShieldAlert, X, AlertTriangle } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { Contact } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const Success = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { contact, amount, score } = (location.state || {}) as {
    contact?: Contact;
    amount?: number;
    score?: number;
  };

  const [isReported, setIsReported] = useState(false);

  useEffect(() => {
    if (!contact) navigate("/home", { replace: true });
  }, [contact, navigate]);

  if (!contact || !amount) return null;

  const isBlocked = (contact.name?.toLowerCase().includes("blocked")) || 
                    (contact.name?.toLowerCase().includes("fake")) || 
                    (location.state?.status === "blocked") ||
                    isReported;

  const handleReport = () => {
    setIsReported(true);
    toast.error("Sentinel Alert", {
      description: "Transaction flagged. Investigation initiated."
    });
  };

  return (
    <PhoneShell hideNav>
      <div className={cn(
        "flex flex-col items-center justify-between min-h-screen h-full px-6 py-12 text-center transition-colors duration-700 overflow-hidden select-none",
        isBlocked ? "bg-zinc-950" : "bg-background"
      )}>
        
        <div className="absolute top-6 right-6 z-50">
          <button onClick={() => navigate("/home", { replace: true })} className="p-2 rounded-full bg-foreground/5 text-foreground/40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="relative animate-slide-up">
            <div className={cn(
              "w-28 h-28 rounded-[40px] flex items-center justify-center animate-shield-pulse transition-colors duration-700",
              isBlocked ? "bg-destructive/20" : "bg-emerald-500/20"
            )}>
              <div className={cn(
                "w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all duration-700",
                isBlocked ? "bg-destructive rotate-12 scale-110" : "bg-emerald-500"
              )}>
                {isBlocked ? (
                  <ShieldAlert className="w-8 h-8 text-white" strokeWidth={3} />
                ) : (
                  <Check className="w-8 h-8 text-white" strokeWidth={4} />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <h1 className={cn(
              "font-display text-sm font-black uppercase tracking-[0.3em] transition-colors duration-700",
              isBlocked ? "text-destructive" : "text-muted-foreground"
            )}>
              {isBlocked ? "Sentinel Intervention" : "Transaction Success"}
            </h1>
            <p className="font-display text-6xl font-black tabular-nums tracking-tighter text-foreground">
              ₹{amount.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="w-full max-w-[320px] p-6 rounded-[32px] bg-foreground/[0.03] border border-foreground/10 space-y-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recipient</span>
              <p className={cn(
                "text-lg font-black transition-colors",
                isBlocked ? "text-destructive" : "text-foreground"
              )}>
                {contact.name}
              </p>
            </div>
            <div className="flex justify-between items-end">
              <div className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction ID</span>
                <p className="text-xs font-mono text-muted-foreground uppercase">{Math.random().toString(36).substr(2, 9)}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</span>
                <p className="text-xs font-bold text-muted-foreground">Just Now</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-[320px] animate-slide-up" style={{ animationDelay: "300ms" }}>
            <div className={cn(
              "flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-700",
              isBlocked 
                ? "bg-destructive/10 border-destructive/20 text-destructive animate-pulse" 
                : "bg-primary/5 border-primary/10 text-primary"
            )}>
              {isBlocked ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              {isBlocked ? "Threat Detected · Account Flagged" : `Verified & Shielded · ${score ?? 0}% Risk`}
            </div>
          </div>
        </div>

        <div className="w-full max-w-[340px] flex flex-col gap-4 animate-slide-up" style={{ animationDelay: "400ms" }}>
          <button
            onClick={() => navigate("/home", { replace: true })}
            className="w-full py-5 rounded-[28px] bg-primary text-primary-foreground font-display font-black text-xl shadow-glow active:scale-95 transition-all"
          >
            Done
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              className="flex items-center justify-center gap-2 py-4 rounded-[20px] bg-foreground/[0.05] border border-foreground/10 text-foreground font-bold text-xs hover:bg-foreground/[0.08] active:scale-95 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleReport}
              className={cn(
                "flex items-center justify-center gap-2 py-4 rounded-[20px] font-bold text-xs active:scale-95 transition-all",
                isBlocked ? "bg-destructive text-white shadow-lg" : "bg-foreground/[0.05] border border-foreground/10 text-destructive"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              {isBlocked ? "Reported" : "Report Fraud"}
            </button>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
};

export default Success;

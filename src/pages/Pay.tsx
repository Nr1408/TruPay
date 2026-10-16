import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2, ShieldAlert, BadgeCheck, Ban, MessageSquare } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TrustBadge } from "@/components/TrustBadge";
import { Contact, computeRisk } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { generateFeatures, checkFraud, publishTransaction } from "@/services/fraudService";
import { BiometricPrompt } from "@/components/BiometricPrompt";
import { UpiPinPad } from "@/components/UpiPinPad";
import { NativePermissionDialog } from "@/components/NativePermissionDialog";
import { updateBalance } from "@/lib/upi";
import { canMakePayment, getDailyLimit, getTodaySpent } from "@/lib/limits";
import { addTransaction } from "@/lib/transactions";
import { toast } from "sonner";
import { BACKEND_IP } from "@/config";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { getBankAccounts, type BankAccount } from "@/lib/bankAccounts";
import { App as CapacitorApp } from "@capacitor/app";

const Pay = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const contact = location.state?.contact as Contact | undefined;

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinMode, setPinMode] = useState<"pay" | "balance">("pay");
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [liveRiskScore, setLiveRiskScore] = useState(0);
  const [showBanks, setShowBanks] = useState(false);
  const [selectedBank, setSelectedBank] = useState(0);
  const [viewingBalance, setViewingBalance] = useState<number | null>(null);
  const [fraudMode, setFraudMode] = useState<"live" | "simulated">("live");
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(
    localStorage.getItem("trupay_location_permission") === "granted"
  );

  const banks = getBankAccounts();

  const transactionId = useRef(`txn_${Math.random().toString(36).substr(2, 9)}`);
  const numericAmount = useMemo(() => parseFloat(amount || "0"), [amount]);

  useEffect(() => {
    if (!contact || numericAmount <= 0) {
      setLiveRiskScore(0);
      return;
    }

    const timer = setTimeout(async () => {
      if (numericAmount <= 0) return;
      
      let lat = 0, lon = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch (e) {
        console.warn("GPS Access Denied/Timed out. Using fallback.");
      }

      try {
        const result = await checkFraud(
          generateFeatures(contact, numericAmount, { lat, lon }), 
          contact.upi, 
          numericAmount,
          transactionId.current
        );
        const base = contact.trust === 'risky' ? 65 : 10;
        setLiveRiskScore(Math.max(base, result.score));
        setFraudMode(result.mode);
      } catch (err) {
        setLiveRiskScore(numericAmount > 1000 ? 45 : 12);
        setFraudMode("simulated");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [numericAmount, contact]);

  useEffect(() => {
    if (!contact) navigate("/send", { replace: true });
  }, [contact, navigate]);

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("backButton", () => {
      if (showPinPad) {
        setShowPinPad(false);
        return;
      }
      if (showFraudAlert) {
        setShowFraudAlert(false);
        return;
      }
      if (showLimitAlert) {
        setShowLimitAlert(false);
        return;
      }
      if (showBanks) {
        setShowBanks(false);
        return;
      }
      navigate("/send", { replace: true });
    }).then((handle) => { listener = handle; });
    return () => { void listener?.remove(); };
  }, [navigate, showBanks, showFraudAlert, showLimitAlert, showPinPad]);

  if (!contact) return null;

  const press = (k: string) => {
    if (k === "del") return setAmount((a) => a.slice(0, -1));
    if (k === "." && amount.includes(".")) return;
    if (amount.length >= 9) return;
    setAmount((a) => (a === "0" ? k : a + k));
  };

  const handlePay = async () => {
    if (numericAmount <= 0) return;

    const { canPay } = canMakePayment(numericAmount);
    if (!canPay) {
      setShowLimitAlert(true);
      return;
    }

    if (!hasLocationPermission) {
      setShowLocationPermission(true);
      return;
    }

    executePaySequence();
  };

  const executePaySequence = async () => {
    setChecking(true);
    setPinMode("pay");
    
    let lat = 0, lon = 0;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch (e) {
      console.warn("GPS Access Denied/Timed out.");
    }

    try {
      const result = await checkFraud(
        generateFeatures(contact, numericAmount, { lat, lon }), 
        contact.upi, 
        numericAmount, 
        transactionId.current
      );
      setFraudMode(result.mode);
      const isDatabaseRisky = contact.isRisky || contact.name.toLowerCase().includes("amazon");
      setChecking(false);
      
      if (result.isFraud || isDatabaseRisky) {
        setShowFraudAlert(true);
      } else {
        setIsVerified(true);
        setTimeout(() => {
          setIsVerified(false);
          setShowPinPad(true);
        }, 1500);
      }
    } catch (err) {
      setChecking(false);
      toast.error("Fraud Engine Connection Failed", {
        description: `Could not reach ${BACKEND_IP}.`,
      });
    }
  };

  const onPinSuccess = () => {
    setShowPinPad(false);
    if (pinMode === "balance") {
      setViewingBalance(selectedBank);
      setTimeout(() => setViewingBalance(null), 5000);
    } else {
      const features = generateFeatures(contact, numericAmount);
      const completedTransaction = addTransaction({
        name: contact.name,
        type: "sent",
        amount: numericAmount,
        shielded: true
      });
      void publishTransaction(
        features,
        contact.upi,
        numericAmount,
        completedTransaction.id,
        liveRiskScore >= 70 ? 1 : 0,
      );
      updateBalance(numericAmount, "debit");
      navigate("/success", { replace: true, state: { contact, amount: numericAmount, score: liveRiskScore } });
    }
  };

  const viewRiskDetails = () => {
    setShowFraudAlert(false);
    const { scenario } = computeRisk(contact, numericAmount);
    navigate("/risk", { 
      state: { 
        contact, 
        amount: numericAmount, 
        note, 
        scenario, 
        score: Math.max(liveRiskScore, 70) 
      } 
    });
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
  const shouldHideButton = showFraudAlert || showLimitAlert;

  return (
    <PhoneShell hideNav>
      <div className="flex flex-col h-full bg-background overflow-hidden select-none">
        {/* Fixed Header */}
        <header className="shrink-0 px-5 pt-8 pb-2 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 mb-0.5">Paying to</p>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-display font-bold truncate">{contact.name}</p>
              <TrustBadge trust={contact.trust} compact />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col pt-4 overflow-hidden">
          <div className="px-5 text-center animate-slide-up shrink-0">
            <p className="text-[10px] text-muted-foreground/60 font-medium mb-3 tabular-nums uppercase tracking-widest">{contact.upi}</p>
            
            <div className="flex items-start justify-center gap-1.5 mb-4">
              <span className="font-display text-4xl font-bold text-muted-foreground mt-2">₹</span>
              <span className={cn(
                "font-display text-6xl font-bold tabular-nums tracking-tighter transition-all duration-300",
                !amount ? "text-muted-foreground/20" : "text-foreground"
              )}>
                {amount || "0"}
              </span>
            </div>
            
            <div className="relative w-full max-w-[240px] mx-auto group mb-4">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                <MessageSquare className="w-4 h-4" />
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this for?"
                className="w-full bg-secondary/30 border border-transparent rounded-xl py-2.5 pl-10 pr-4 text-xs text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background focus:border-primary/30 transition-all shadow-inner"
              />
            </div>

            {/* Live Risk Meter */}
            <div className="px-10 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className={cn("w-3.5 h-3.5", liveRiskScore > 30 ? "text-amber-500" : "text-primary")} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sentinel Risk Analysis</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", fraudMode === 'live' ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-blue-500")} />
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/80">
                      {fraudMode === 'live' ? "Cloud AI Live" : "Local Secure Mode"}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-zinc-300/50 shadow-inner">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300 ease-out border-r border-white/20",
                      liveRiskScore > 70 ? "bg-destructive" : liveRiskScore > 30 ? "bg-yellow-500" : "bg-primary"
                    )}
                    style={{ width: `${liveRiskScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 flex-1 flex flex-col justify-center">
            {!showBanks ? (
              <div className="px-4 grid grid-cols-3 gap-x-6 gap-y-1">
                {keys.map((k) => (
                  <button 
                    key={k} 
                    onClick={() => press(k)} 
                    className={cn(
                      "h-14 flex items-center justify-center rounded-2xl text-2xl font-display font-semibold transition-all duration-200 active:scale-90",
                      k === "del" ? "text-muted-foreground hover:text-foreground" : "hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    {k === "del" ? "⌫" : k}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black px-2 mb-3">Choose Account</p>
                {banks.map((bank: BankAccount, i) => (
                  <div 
                    key={bank.name}
                    onClick={() => setSelectedBank(i)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-3xl border-2 transition-all duration-300 cursor-pointer shadow-sm",
                      selectedBank === i ? "bg-primary/5 border-primary" : "bg-card border-transparent hover:border-border"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedBank === i ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}>
                        {selectedBank === i && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{bank.bankName}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{bank.accountNumber}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className={cn(
          "shrink-0 px-5 pb-8 pt-4 transition-all duration-500",
          shouldHideButton ? "opacity-0 pointer-events-none translate-y-10" : "opacity-100 translate-y-0"
        )}>
          <div className="max-w-[400px] mx-auto">
            <div className="flex items-center gap-2 justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-4 opacity-50">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              AI Shield Protection Active
            </div>
            
            <button
              onClick={() => showBanks ? handlePay() : setShowBanks(true)}
              disabled={numericAmount <= 0 || checking}
              className={cn(
                "w-full py-5 rounded-[28px] font-display font-black text-lg text-primary-foreground transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98]",
                numericAmount > 0 ? "bg-gradient-primary shadow-glow hover:brightness-110" : "bg-muted text-muted-foreground grayscale"
              )}
            >
              {checking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="animate-pulse">Analyzing Risk…</span>
                </>
              ) : (
                <>{showBanks ? `Pay ₹${numericAmount.toLocaleString("en-IN")}` : "Proceed To Pay"}</>
              )}
            </button>
          </div>
        </div>

        <UpiPinPad isOpen={showPinPad} onClose={() => setShowPinPad(false)} onSuccess={onPinSuccess} payeeName={contact.name} amount={numericAmount} />

        <NativePermissionDialog
          isOpen={showLocationPermission}
          type="location"
          onGrant={() => {
            localStorage.setItem("trupay_location_permission", "granted");
            setHasLocationPermission(true);
            setShowLocationPermission(false);
            executePaySequence();
          }}
          onDeny={() => {
            setShowLocationPermission(false);
            toast.error("Location Required", {
              description: "TruPay requires location to verify payment security."
            });
          }}
        />

        <AlertDialog open={showLimitAlert} onOpenChange={setShowLimitAlert}>
          <AlertDialogContent className="rounded-[40px] max-w-[90%] w-[360px] p-8 bg-zinc-900 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
            <AlertDialogHeader>
              <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-500/20 flex items-center justify-center mb-4 border border-amber-500/30">
                <Ban className="w-8 h-8 text-amber-500" />
              </div>
              <AlertDialogTitle className="text-center font-display text-2xl font-bold text-white">Limit Exceeded</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-zinc-400 text-base leading-relaxed">
                Daily quota reached.
                <br/><br/>
                Remaining: <span className="text-amber-500 font-bold">₹{Math.max(getDailyLimit() - getTodaySpent(), 0).toLocaleString("en-IN")}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogAction onClick={() => setShowLimitAlert(false)} className="bg-white text-black rounded-2xl py-7 text-lg font-bold w-full hover:bg-zinc-200 transition-colors">
                Got it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showFraudAlert} onOpenChange={setShowFraudAlert}>
          <AlertDialogContent className="rounded-[40px] max-w-[90%] w-[360px] p-8 bg-zinc-900 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
            <AlertDialogHeader>
              <div className="mx-auto w-16 h-16 rounded-3xl bg-destructive/20 flex items-center justify-center mb-4 border border-white/10">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center font-display text-2xl font-bold text-white">Fraud Alert!</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-zinc-400 text-base leading-relaxed">
                Our AI Shield has flagged this transaction as <span className="text-destructive font-bold">High Risk</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-3 mt-8">
              <AlertDialogAction 
                onClick={viewRiskDetails} 
                className="bg-destructive text-white rounded-2xl py-7 text-lg font-bold shadow-lg shadow-destructive/25 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                View Detailed Risk
              </AlertDialogAction>
              <AlertDialogCancel 
                onClick={() => navigate("/home")} 
                className="rounded-2xl py-7 text-lg font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Cancel Securely
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PhoneShell>
  );
};

export default Pay;

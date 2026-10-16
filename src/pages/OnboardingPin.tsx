import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Delete, Loader2, Check, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PhoneShell } from "@/components/PhoneShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NativePermissionDialog } from "@/components/NativePermissionDialog";
import { createPinCredential, savePinCredential } from "@/lib/pinSecurity";

const OnboardingPin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showContactsPermission, setShowContactsPermission] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const pinLength = 4;

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);

  const handleNumber = (num: number) => {
    if (pin.length < pinLength) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  useEffect(() => {
    if (pin.length === pinLength) {
      const timer = setTimeout(() => {
        if (step === "enter") {
          setConfirmPin(pin);
          setPin("");
          setStep("confirm");
        } else {
          if (pin === confirmPin) {
            handleComplete(pin);
          } else {
            setError(true);
            setPin("");
            toast.error("PINs do not match. Try again.");
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pin, step, confirmPin]);

  const handleComplete = async (finalPin: string) => {
    setLoading(true);
    try {
      const credential = await createPinCredential(finalPin);
      await savePinCredential(credential);
      
      // Sync the profile in the background without blocking onboarding when the
      // device is offline or Firestore is temporarily unavailable.
      const { saveProfileToCloud } = await import("@/lib/userProfile");
      await withTimeout(saveProfileToCloud(credential), 8000);
      
      // Mark as already verified for this session
      sessionStorage.setItem("trupay_unlocked", "true");
      
      // Success state for PIN
      toast.success("Security PIN Set Successfully!");
      
      // Now ask for Contacts Permission
      setLoading(false);
      setShowContactsPermission(true);
      
    } catch (error) {
      toast.error("Failed to save PIN. Please try again.");
      setLoading(false);
    }
  };

  const handleContactsGrant = () => {
    localStorage.setItem("trupay_contacts_synced", "true");
    setShowContactsPermission(false);
    setIsSyncing(true);
    
    // Simulate high-tech sync
    setTimeout(() => {
      window.dispatchEvent(new Event("storage"));
      navigate("/home", { replace: true });
    }, 2500);
  };

  const deleteLast = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <PhoneShell hideNav>
      <div className="h-full flex flex-col px-8 pt-10 pb-12 bg-background relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32" />

        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-8 shadow-inner border border-primary/20">
            {isSyncing ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <Lock className="w-10 h-10 text-primary" />
            )}
          </div>
          
          <h1 className="text-3xl font-display font-bold mb-3 animate-in fade-in duration-700">
            {isSyncing ? "Syncing Contacts" : (step === "enter" ? "Set Security PIN" : "Confirm PIN")}
          </h1>
          <p className="text-muted-foreground text-sm max-w-[240px] mb-12 animate-in fade-in duration-700 delay-100 text-center">
            {isSyncing 
              ? "Mapping your secure network for faster payments..." 
              : (step === "enter" 
                  ? "Create a 4-digit PIN to secure all your future payments." 
                  : "Re-enter your 4-digit PIN to verify.")}
          </p>

          {!isSyncing && (
            <div className={cn("flex gap-6 mb-12", error && "animate-shake")}>
              {[...Array(pinLength)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all duration-300",
                    i < pin.length 
                      ? "bg-primary border-primary scale-125 shadow-glow" 
                      : cn("bg-transparent border-primary/20", error && "border-destructive/40")
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Keypad */}
        {!isSyncing && (
          <div className="grid grid-cols-3 gap-y-4 gap-x-8 mb-8 animate-in fade-in duration-700 delay-300">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumber(num)}
                disabled={loading}
                className="w-16 h-16 rounded-2xl bg-secondary/50 text-2xl font-display font-bold hover:bg-primary/10 hover:text-primary transition-all active:scale-90 flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <div />
            <button
              onClick={() => handleNumber(0)}
              disabled={loading}
              className="w-16 h-16 rounded-2xl bg-secondary/50 text-2xl font-display font-bold hover:bg-primary/10 hover:text-primary transition-all active:scale-90 flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={deleteLast}
              disabled={loading}
              className="w-16 h-16 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors active:scale-90"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-sm font-bold text-primary animate-pulse uppercase tracking-[0.2em]">Securing Vault...</p>
          </div>
        )}

        <NativePermissionDialog
          isOpen={showContactsPermission}
          type="contacts"
          onGrant={handleContactsGrant}
          onDeny={() => {
            setShowContactsPermission(false);
            navigate("/home", { replace: true });
          }}
        />
      </div>
    </PhoneShell>
  );
};

export default OnboardingPin;

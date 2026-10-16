import React, { useState, useEffect, useCallback } from "react";
import { Fingerprint, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  registerBiometric,
  authenticateBiometric,
  isBiometricAvailable
} from "@/lib/biometrics";

interface BiometricPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** "enroll" = register new credential, "verify" = authenticate with stored credential */
  mode?: "enroll" | "verify";
  type?: "fingerprint";
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = "verify",
  type = "fingerprint",
}) => {
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const run = useCallback(async () => {
    setErrorMessage("");
    setStatus("scanning");

    try {
      const success = mode === "enroll"
        ? await registerBiometric(type)
        : await authenticateBiometric(type);

      if (success) {
        setStatus("success");
        // Give time to show the success state then close
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1200);
      } else {
        setStatus("idle");
        toast.error("Biometric verification failed. Use your PIN instead.");
      }
    } catch (error) {
      console.error("Biometric process error:", error);
      setStatus("idle");
      toast.error("Biometric error. Try using your PIN.");
    }
  }, [mode, onSuccess, type]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      setErrorMessage("");
      return;
    }
    run();
    return;
  }, [isOpen, run]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
      <div
        className={cn(
          "w-full max-w-[340px] aspect-[4/5] bg-zinc-900/50 border border-white/10 rounded-[48px] p-8 shadow-2xl flex flex-col items-center justify-between relative overflow-hidden",
          status === "success" && "border-primary/50"
        )}
      >
        {/* Animated Background Scan Lines */}
        {status === "scanning" && (
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute inset-x-0 h-1 bg-primary animate-[scan-y_2s_ease-in-out_infinite]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-10 animate-pulse" />
          </div>
        )}

        <div className="w-full flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">Sentinel ID v4.5</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-white/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
          <div className="relative group">
            {/* Outer Rings */}
            <div className={cn(
              "absolute inset-[-24px] rounded-full border border-primary/5 transition-all duration-1000",
              status === "scanning" && "animate-[spin_8s_linear_infinite] border-primary/20"
            )} />
            <div className={cn(
              "absolute inset-[-12px] rounded-full border border-dashed border-primary/10 transition-all duration-1000",
              status === "scanning" && "animate-[spin_12s_linear_reverse_infinite] border-primary/40"
            )} />

            {/* Main Icon/Scan Area */}
            <div className={cn(
              "w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 relative z-10 overflow-hidden",
              status === "scanning" ? "bg-black/40 shadow-[0_0_40px_rgba(var(--primary),0.1)]" : 
              status === "success" ? "bg-primary shadow-[0_0_50px_rgba(var(--primary),0.4)]" : "bg-white/5"
            )}>
              {status === "success" ? (
                <ShieldCheck className="w-20 h-20 text-white animate-in zoom-in duration-500" />
              ) : (
                <Fingerprint className={cn("w-20 h-20 transition-all duration-500", status === "scanning" ? "text-primary animate-pulse" : "text-white/20")} />
              )}
            </div>
          </div>

          <div className="text-center space-y-2 z-10">
            <h3 className="font-display text-2xl font-black text-white tracking-tight">
              {status === "scanning" ? "Waiting for device biometric..." : status === "success" ? "Verified" : "Access Denied"}
            </h3>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
              {status === "scanning" 
                ? "Confirm in the Android biometric prompt"
                : status === "success" ? "Sentinel Identity Confirmed" : "Authentication Required"}
            </p>
          </div>
        </div>

        <div className="w-full pt-6">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
          >
            Cancel & Use PIN
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes scan-y {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(300px); }
        }
        @keyframes scan-line {
          0% { transform: translateY(-80px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

import { useState, useEffect } from "react";
import { BiometricPrompt } from "./BiometricPrompt";
import { Shield, KeyRound, Lock } from "lucide-react";
import { getBiometricSettings } from "@/lib/biometrics";
import { UpiPinPad } from "./UpiPinPad";
import { cn } from "@/lib/utils";
import { App } from "@capacitor/app";
import { hasPinCredential } from "@/lib/pinSecurity";

export const AppLock = ({ children }: { children: React.ReactNode }) => {
  const [biometricSettings] = useState(() => getBiometricSettings());
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);

  useEffect(() => {
    let active = true;
    void hasPinCredential().then((hasPin) => {
      if (!active) return;
      const hasName = !!localStorage.getItem("trupay_user_name");
      const isSessionUnlocked = sessionStorage.getItem("trupay_unlocked") === "true";
      setIsLocked(hasName && hasPin && !isSessionUnlocked);
      setIsChecking(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isLocked) return;

    // Trigger biometric prompt on mount
    const timer = setTimeout(() => {
      setShowBiometric(true);
    }, 600);

    // Re-lock app when it returns from background
    const handleAppStateChange = (state: { isActive: boolean }) => {
      if (state.isActive) {
        setIsLocked(true);
        setShowBiometric(true);
      }
    };

    const listener = App.addListener('appStateChange', handleAppStateChange);

    return () => {
      clearTimeout(timer);
      listener.then(l => l.remove());
    };
  }, [isLocked]);

  const handleUnlock = () => {
    sessionStorage.setItem("trupay_unlocked", "true");
    setShowBiometric(false);
    setShowPinPad(false);
    setIsLocked(false);
  };

  if (isChecking) return (
    <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center text-white">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary animate-pulse">Securing app…</div>
    </div>
  );
  if (!isLocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-between p-10 py-20 text-center animate-in fade-in duration-700">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center relative shadow-2xl">
            <Lock className="w-10 h-10 text-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="font-display text-3xl font-black text-white tracking-tight">Sentinel Guard</h1>
          <p className="text-zinc-500 text-sm max-w-[220px] leading-relaxed font-medium uppercase tracking-widest text-[10px]">
            Encrypted Session Active. <br/> Please Verify Identity.
          </p>
        </div>
      </div>
      
      <div className="w-full max-w-[280px] space-y-4 relative z-10">
        <button
          onClick={() => setShowBiometric(true)}
          className="w-full py-5 rounded-[24px] bg-primary text-white font-display font-black text-sm uppercase tracking-[0.2em] shadow-glow active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          Use Fingerprint
        </button>

        <button
          onClick={() => setShowPinPad(true)}
          className="w-full py-4 rounded-[24px] bg-white/5 border border-white/10 text-white/40 font-display font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <KeyRound className="w-4 h-4 opacity-40" />
          Unlock with PIN
        </button>
      </div>

      <BiometricPrompt
        isOpen={showBiometric}
        onClose={() => setShowBiometric(false)}
        onSuccess={handleUnlock}
        type="fingerprint"
      />

      <UpiPinPad 
        isOpen={showPinPad} 
        onClose={() => setShowPinPad(false)} 
        onSuccess={handleUnlock}
        title="Sentinel PIN"
        description="Enter your 4-digit security code"
      />

      <div className="mt-12 opacity-20 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Secure Link Active</span>
        </div>
      </div>
    </div>
  );
};

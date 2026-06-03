import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Fingerprint, ScanFace, ChevronRight, Lock, CheckCircle2 } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { cn } from "@/lib/utils";
import { isBiometricAvailable, setBiometricSettings } from "@/lib/biometrics";
import { FaceIdScanner } from "@/components/FaceIdScanner";
import { toast } from "sonner";

const OnboardingBiometric = () => {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [type, setType] = useState<"face" | "fingerprint">("face");

  useEffect(() => {
    isBiometricAvailable().then(setAvailable);
  }, []);

  const handleEnable = () => {
    if (type === "face") {
      setShowScanner(true);
    } else {
      // Fingerprint still uses native default for now
      enrollNative();
    }
  };

  const enrollNative = async () => {
    const { registerBiometric } = await import("@/lib/biometrics");
    const success = await registerBiometric(type);
    if (success) {
      setBiometricSettings({ enabled: true, type });
      toast.success(`${type === "face" ? "Face ID" : "Fingerprint"} enabled successfully!`);
      navigate("/onboarding/phone", { replace: true });
    } else {
      toast.error("Biometric enrollment failed. Please try again or skip.");
    }
  };

  const onScannerSuccess = () => {
    setShowScanner(false);
    setBiometricSettings({ enabled: true, type: "face" });
    toast.success("Face ID enrolled successfully via Sentinel Vision! 🛡️");
    navigate("/onboarding/phone", { replace: true });
  };

  if (showScanner) {
    return <FaceIdScanner onSuccess={onScannerSuccess} onCancel={() => setShowScanner(false)} />;
  }

  return (
    <PhoneShell hideNav>
      <div className="h-full flex flex-col px-8 pt-10 pb-12 bg-background relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32" />

        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center mb-10 shadow-inner border border-primary/20">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 animate-in fade-in duration-700">
            Secure your Vault.
          </h1>
          <p className="text-muted-foreground text-sm max-w-[280px] leading-relaxed mb-12 animate-in fade-in duration-700 delay-100">
            Use biometrics for lightning-fast payments and unbreakable account protection.
          </p>

          <div className="w-full space-y-4 mb-12">
            <button
              onClick={() => setType("face")}
              className={cn(
                "w-full p-6 rounded-[32px] border-2 transition-all duration-300 flex items-center gap-4 group",
                type === "face" ? "bg-primary/5 border-primary shadow-glow" : "bg-card border-transparent hover:border-border"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                type === "face" ? "bg-primary text-white" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <ScanFace className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Face ID</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Recommended</p>
              </div>
              {type === "face" && <CheckCircle2 className="w-5 h-5 text-primary ml-auto animate-in zoom-in" />}
            </button>

            <button
              onClick={() => setType("fingerprint")}
              className={cn(
                "w-full p-6 rounded-[32px] border-2 transition-all duration-300 flex items-center gap-4 group",
                type === "fingerprint" ? "bg-primary/5 border-primary shadow-glow" : "bg-card border-transparent hover:border-border"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                type === "fingerprint" ? "bg-primary text-white" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <Fingerprint className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Touch ID</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fingerprint</p>
              </div>
              {type === "fingerprint" && <CheckCircle2 className="w-5 h-5 text-primary ml-auto animate-in zoom-in" />}
            </button>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          <button
            onClick={handleEnable}
            className="w-full h-16 rounded-[28px] bg-primary text-primary-foreground font-display font-black uppercase tracking-[0.2em] shadow-glow flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            Enable {type === "face" ? "Face ID" : "Touch ID"}
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => navigate("/onboarding/pin")}
            className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
          >
            I'll do it later
          </button>
        </div>
      </div>
    </PhoneShell>
  );
};

export default OnboardingBiometric;

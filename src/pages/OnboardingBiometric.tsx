import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Fingerprint, ChevronRight } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { isBiometricAvailable, setBiometricSettings, registerBiometric } from "@/lib/biometrics";
import { toast } from "sonner";

const OnboardingBiometric = () => {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then(setAvailable);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const success = await registerBiometric("fingerprint");
      if (!success) {
        toast.error("Fingerprint verification failed. Please try again or skip.");
        return;
      }
      setBiometricSettings({ enabled: true, type: "fingerprint" });
      toast.success("Fingerprint enabled successfully! 🛡️");
      navigate("/onboarding/phone", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PhoneShell hideNav>
      <div className="h-full flex flex-col px-8 pt-10 pb-12 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center mb-10 shadow-inner border border-primary/20">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">Secure your Vault.</h1>
          <p className="text-muted-foreground text-sm max-w-[280px] leading-relaxed mb-12">
            Use your fingerprint for fast, secure app entry and payment authorization.
          </p>
          <div className="w-full p-6 rounded-[32px] border-2 border-primary bg-primary/5 shadow-glow flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Fingerprint</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {available ? "Available on this device" : "Check device settings"}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 relative z-10">
          <button onClick={handleEnable} disabled={loading || !available} className="w-full h-16 rounded-[28px] bg-primary text-primary-foreground font-display font-black uppercase tracking-[0.2em] shadow-glow flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
            {loading ? "Verify Fingerprint" : "Enable Fingerprint"}
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => navigate("/onboarding/pin")} className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors">
            I’ll do it later
          </button>
        </div>
      </div>
    </PhoneShell>
  );
};

export default OnboardingBiometric;

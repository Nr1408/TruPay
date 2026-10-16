import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Moon, Sun, Bell, Shield, User, ChevronRight, Lock, 
  HelpCircle, Sparkles, Activity, Cloud, Fingerprint, CheckCircle2
} from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { getTheme, setTheme, Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { getBiometricSettings, setBiometricSettings, isBiometricAvailable } from "@/lib/biometrics";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [theme, setAppTheme] = useState<Theme>(getTheme());
  
  // Biometric States
  const [biometricSettings, setBioSettings] = useState(getBiometricSettings());

  // AI Settings States
  const [aiProtection, setAiProtection] = useState(true);
  const [neuralLearning, setNeuralLearning] = useState(true);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setAppTheme(newTheme);
    setTheme(newTheme);
  };

  const handleToggleBiometrics = () => {
    const nextState = !biometricSettings.enabled;
    const newSettings = { ...biometricSettings, enabled: nextState };
    setBiometricSettings(newSettings);
    setBioSettings(newSettings);
    
    if (nextState) {
      toast.success("Fingerprint enabled! 🛡️");
    } else {
      toast.info("Biometric lock disabled. 🔓");
    }
  };

  const handleEnableBiometrics = async () => {
    const { registerBiometric } = await import("@/lib/biometrics");
    const success = await registerBiometric("fingerprint");
    if (success) {
      const newSettings = { enabled: true, type: "fingerprint" as const };
      setBiometricSettings(newSettings);
      setBioSettings(newSettings);
      toast.success("Fingerprint enabled successfully! 🛡️");
    }
  };

  return (
    <PhoneShell>
      <div className="flex flex-col h-full bg-background select-none">
        {/* Header */}
        <header className="shrink-0 px-6 pt-10 pb-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/home")}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-black">Settings</h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-8 pb-10">
          
          {/* Security & Biometrics Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Security</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
              </div>
            </div>
            
            <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm divide-y divide-border/30">
              {/* Real-time Protection */}
              <div 
                onClick={() => setAiProtection(!aiProtection)}
                className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Real-time Protection</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Auto-block suspicious UPI IDs</p>
                  </div>
                </div>
                <Toggle active={aiProtection} />
              </div>

              {/* Neural Pattern Recognition */}
              <div 
                onClick={() => setNeuralLearning(!neuralLearning)}
                className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Neural Pattern Recognition</p>
                    <p className="text-[10px] text-muted-foreground font-medium">ML-driven behavior analysis</p>
                  </div>
                </div>
                <Toggle active={neuralLearning} />
              </div>

              {/* Integrated Biometric Setup */}
              <div className="p-6 space-y-6 bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Biometric Vault</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Secure app entry & payments</p>
                    </div>
                  </div>
                  <div 
                    onClick={handleToggleBiometrics}
                    className="cursor-pointer"
                  >
                    <Toggle active={biometricSettings.enabled} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-primary bg-primary/10 flex items-center gap-3">
                  <Fingerprint className="w-6 h-6 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Fingerprint only</span>
                </div>

                <button
                  onClick={handleEnableBiometrics}
                  className={cn(
                    "w-full py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2",
                    biometricSettings.enabled
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-white shadow-glow"
                  )}
                >
                  {biometricSettings.enabled ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Vault Secured
                    </>
                  ) : (
                    <>Configure Fingerprint</>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-2">Appearance</p>
            <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm">
              <div 
                onClick={toggleTheme}
                className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors",
                    theme === "dark" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
                  )}>
                    {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">Dark Mode</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Toggle app theme</p>
                  </div>
                </div>
                <Toggle active={theme === "dark"} />
              </div>
            </div>
          </section>

          {/* General Section */}
          <section className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-2">Account</p>
            <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm divide-y divide-border/50">
              <SettingItem 
                icon={<User className="w-5 h-5" />} 
                title="Personal Info" 
                subtitle="KYC & Bank details" 
                color="text-zinc-500 bg-zinc-100" 
              />
              <SettingItem 
                icon={<Bell className="w-5 h-5" />} 
                title="Notifications" 
                subtitle="Transaction & Fraud alerts" 
                color="text-zinc-500 bg-zinc-100" 
              />
            </div>
          </section>

        </div>
      </div>
    </PhoneShell>
  );
};

const Toggle = ({ active }: { active: boolean }) => (
  <div className={cn(
    "w-12 h-6 rounded-full p-1 transition-all duration-300",
    active ? "bg-primary" : "bg-muted"
  )}>
    <div className={cn(
      "w-4 h-4 rounded-full bg-white transition-all duration-300 transform",
      active ? "translate-x-6" : "translate-x-0"
    )} />
  </div>
);

const SettingItem = ({ icon, title, subtitle, color, onClick }: { icon: any, title: string, subtitle: string, color: string, onClick?: () => void }) => (
  <div onClick={onClick} className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-all cursor-pointer group">
    <div className="flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-colors", color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[10px] text-muted-foreground font-medium">{subtitle}</p>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
  </div>
);

export default Settings;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { X, Shield, CreditCard, Settings, LogOut, ChevronRight, Share2, BadgeCheck, Fingerprint, Languages, Check, Building2, Plus, ArrowLeft, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getBankAccounts, setDefaultAccount, removeBankAccount, type BankAccount } from "@/lib/bankAccounts";
import { getDailyLimit, setDailyLimit, getTodaySpent } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { signOutAndCleanup } from "@/lib/authSession";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showQR, setShowQR] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showBankManager, setShowBankManager] = useState(false);
  const [showLimitManager, setShowLimitManager] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(true);
  
  const [dailyLimit, setDailyLimitState] = useState(getDailyLimit());
  const [todaySpent, setTodaySpent] = useState(getTodaySpent());
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [tempLimit, setTempLimit] = useState(dailyLimit.toString());

  const userName = localStorage.getItem("trupay_user_name") || "User";
  const upiId = `${userName.toLowerCase().replace(/\s+/g, ".")}@upi`;

  const refreshBanks = () => {
    setBankAccounts(getBankAccounts());
  };

  useEffect(() => {
    if (isOpen) {
      refreshBanks();
      setTodaySpent(getTodaySpent());
      setDailyLimitState(getDailyLimit());
    }
  }, [isOpen]);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      const { registerBiometric } = await import("@/lib/biometrics");
      const success = await registerBiometric("fingerprint");
      if (!success) {
        toast.error("Fingerprint verification failed.");
        return;
      }
      setIsEnrolling(false);
      setBioEnabled(true);
      setShowEnroll(false);
      toast.success("Fingerprint enabled successfully.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleSaveLimit = () => {
    const newLimit = parseInt(tempLimit, 10);
    if (isNaN(newLimit) || newLimit < 1) {
      toast.error("Please enter a valid amount");
      return;
    }
    setDailyLimit(newLimit);
    setDailyLimitState(newLimit);
    setIsEditingLimit(false);
    toast.success("Daily limit updated!");
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOutAndCleanup();
      onClose();
      navigate("/", { replace: true });
      toast.success("Signed out successfully.");
    } catch (error) {
      toast.error("Unable to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-[160] w-[85%] max-w-[360px] bg-background shadow-2xl transition-transform duration-500 transform ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
          <div className="px-6 pt-4 pb-4 flex items-center justify-between">
            <h2 className="text-xl font-display font-bold">{t("Profile")}</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-secondary text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-3xl font-display font-bold shadow-glow">
                {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-success border-4 border-background flex items-center justify-center">
                <BadgeCheck className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-bold">{userName}</h3>
            <p className="text-sm text-muted-foreground font-medium">{upiId}</p>
            <button 
              onClick={() => setShowQR(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold"
            >
              <Share2 className="w-3.5 h-3.5" />
              {t("Share QR Code")}
            </button>
          </div>

          <div className="flex-1 px-4 py-6 space-y-6">
            <section>
              <p className="px-4 text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">{t("Security")}</p>
              <div className="space-y-1">
                <MenuItem icon={Shield} label={t("AI Shield Settings")} sub={t("Active & Protecting")} />
                <MenuItem 
                  onClick={async () => {
                    try {
                      const { authenticateBiometric } = await import("@/lib/biometrics");
                      const { Capacitor } = await import("@capacitor/core");
                      if (Capacitor.getPlatform() === 'web') {
                        setShowEnroll(true);
                        return;
                      }
                      const success = await authenticateBiometric();
                      if (success) setShowEnroll(true);
                      else toast.error("Verification failed.");
                    } catch (error) {
                      toast.error("Native Biometrics not available.");
                    }
                  }}
                  icon={Fingerprint}
                  label={t("Biometric Lock")} 
                  sub={bioEnabled ? `${t("Touch ID")} ${t("Active & Protecting").split(' ')[0]}` : "Not Setup"}
                />
              </div>
            </section>

            <section>
              <p className="px-4 text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">{t("Payments")}</p>
              <div className="space-y-1">
                <MenuItem 
                  onClick={() => setShowBankManager(true)}
                  icon={CreditCard} 
                  label={t("Linked Bank Accounts")} 
                  sub={`${bankAccounts.length} Accounts Connected`} 
                />
                <MenuItem 
                  onClick={() => {
                    setTempLimit(dailyLimit.toString());
                    setShowLimitManager(true);
                  }}
                  icon={Settings} 
                  label={t("Transaction Limits")} 
                  sub={`₹${dailyLimit.toLocaleString("en-IN")} ${t("daily")}`} 
                />
              </div>
            </section>

            <section>
              <p className="px-4 text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">{t("App Settings")}</p>
              <div className="space-y-1">
                <MenuItem 
                  onClick={() => { onClose(); navigate("/settings"); }}
                  icon={Settings} 
                  label={t("General Settings")} 
                  sub={t("Theme, Notifications & more")} 
                />
                <MenuItem 
                  onClick={() => setShowLanguagePicker(true)}
                  icon={Languages} 
                  label={t("App Language")} 
                  sub={i18n.language === 'hi' ? 'हिंदी' : i18n.language === 'mr' ? 'मराठी' : 'English'} 
                />
              </div>
            </section>
          </div>

          <div className="p-6 border-t border-border">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/5 text-destructive font-semibold hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {isSigningOut ? t("Signing Out...") : t("Sign Out")}
            </button>
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {showEnroll && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="w-full max-w-[340px] flex flex-col items-center text-center">
            {!isEnrolling && <Fingerprint className="w-16 h-16 text-white/40 mb-10" />}
            <div className="relative mb-12">
              <div className="w-32 h-32 rounded-full border-2 border-white/20 flex items-center justify-center relative overflow-hidden">
                {isEnrolling ? (
                  <>
                    <Fingerprint className="w-16 h-16 text-primary animate-pulse" />
                    <div className="absolute inset-0 border-2 border-primary rounded-full animate-ping opacity-20" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-scan-line shadow-glow" />
                  </>
                ) : (
                  <Fingerprint className="w-16 h-16 text-white/40" />
                )}
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              {isEnrolling ? t("Authenticating...") : t("Secure your App")}
            </h2>
            {!isEnrolling && (
              <div className="w-full space-y-3">
                <button onClick={handleEnroll} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-glow">
                  {bioEnabled ? t("Enable") : t("Enable")}
                </button>
                <button onClick={() => setShowEnroll(false)} className="w-full py-4 rounded-2xl bg-white/5 text-white/60 font-semibold">{t("Skip for now")}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-[320px] flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-full flex justify-end mb-2">
              <button onClick={() => setShowQR(false)} className="p-2 rounded-full bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-bold mb-6 uppercase tracking-widest">TRUPAY SHIELD</div>
            <div className="p-4 bg-gray-50 rounded-3xl border-4 border-gray-100 mb-6">
              <QRCodeSVG value={`upi://pay?pa=${upiId}&pn=${userName}&cu=INR`} size={180} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{userName}</h3>
            <p className="text-sm text-gray-500 mb-6">{upiId}</p>
          </div>
        </div>
      )}

      {/* Limit Manager */}
      {showLimitManager && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-background rounded-[32px] p-8 w-full max-w-[340px] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-display font-bold">{t("Transaction Limits")}</h3>
              </div>
              <button onClick={() => { setShowLimitManager(false); setIsEditingLimit(false); }} className="p-2 rounded-full bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="p-5 rounded-[24px] bg-secondary relative group">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t("daily")} Limit</p>
                {isEditingLimit ? (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-display font-bold text-primary">₹</span>
                    <input 
                      type="number" 
                      value={tempLimit}
                      autoFocus
                      onChange={(e) => setTempLimit(e.target.value)}
                      className="bg-transparent text-2xl font-display font-bold w-full focus:outline-none border-b-2 border-primary pb-1"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-3xl font-display font-bold">₹{dailyLimit.toLocaleString("en-IN")}</p>
                    <button 
                      onClick={() => setIsEditingLimit(true)}
                      className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Used Today</span>
                  <span className="text-sm font-display font-bold">₹{todaySpent.toLocaleString("en-IN")} / ₹{dailyLimit.toLocaleString("en-IN")}</span>
                </div>
                <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000 ease-out rounded-full shadow-glow",
                      (todaySpent / dailyLimit) > 0.9 ? "bg-destructive" : "bg-primary"
                    )} 
                    style={{ width: `${Math.min((todaySpent / dailyLimit) * 100, 100)}%` }} 
                  />
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Remaining: ₹{Math.max(dailyLimit - todaySpent, 0).toLocaleString("en-IN")}
                </p>
              </div>

              {isEditingLimit ? (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsEditingLimit(false)}
                    className="flex-1 py-4 rounded-2xl bg-secondary text-foreground font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveLimit}
                    className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-glow"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLimitManager(false)}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-glow"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bank Manager */}
      {showBankManager && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-background rounded-[32px] p-6 w-full max-w-[340px] shadow-2xl animate-in zoom-in duration-300 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold">{t("Linked Bank Accounts")}</h3>
              <button onClick={() => setShowBankManager(false)} className="p-2 rounded-full bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-1 no-scrollbar">
              {bankAccounts.map((bank) => (
                <div key={bank.id} className={cn("p-4 rounded-2xl border-2 transition-all relative group", bank.isDefault ? "bg-primary/5 border-primary" : "bg-secondary border-transparent")}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary"><Building2 className="w-6 h-6" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{bank.bankName}</p>
                      <p className="text-[10px] text-muted-foreground">{bank.accountNumber} • {bank.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowBankManager(false); navigate("/onboarding/bank"); }} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 shadow-glow">
              <Plus className="w-4 h-4" />
              {t("Link New Account")}
            </button>
          </div>
        </div>
      )}

      {/* Language Picker */}
      {showLanguagePicker && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-background rounded-[32px] p-6 w-full max-w-[320px] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold">{t("Select Language")}</h3>
              <button onClick={() => setShowLanguagePicker(false)} className="p-2 rounded-full bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {[{ code: 'en', label: 'English', native: 'English' }, { code: 'hi', label: 'Hindi', native: 'हिंदी' }, { code: 'mr', label: 'Marathi', native: 'मराठी' }].map((lang) => (
                <button key={lang.code} onClick={() => { i18n.changeLanguage(lang.code); setShowLanguagePicker(false); toast.success(`Language changed to ${lang.label}`); }} className={cn("w-full flex items-center justify-between p-4 rounded-2xl transition-all", i18n.language === lang.code ? "bg-primary/10 border-2 border-primary" : "bg-secondary border-2 border-transparent hover:border-primary/20")}>
                  <div className="text-left">
                    <p className={cn("font-bold", i18n.language === lang.code ? "text-primary" : "text-foreground")}>{lang.native}</p>
                    <p className="text-[10px] text-muted-foreground">{t(lang.label)}</p>
                  </div>
                  {i18n.language === lang.code && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MenuItem = ({ icon: Icon, label, sub, right, onClick }: { icon: any, label: string, sub: string, right?: React.ReactNode, onClick?: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors group text-left">
    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
    {right ? right : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
  </button>
);

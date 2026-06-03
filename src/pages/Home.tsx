import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scan, 
  History, 
  ShieldCheck, 
  ChevronRight, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Bell,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PhoneShell } from "@/components/PhoneShell";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { getTransactions } from "@/lib/transactions";
import { getBalance } from "@/lib/upi";
import { cn } from "@/lib/utils";

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [userName, setUserName] = useState("Arjun Patel");
  const [balance, setBalance] = useState(getBalance());
  const [transactions, setTransactions] = useState(getTransactions().slice(0, 3));

  useEffect(() => {
    const savedName = localStorage.getItem("trupay_user_name");
    if (savedName) setUserName(savedName);
    
    // Refresh data periodically or on focus
    const interval = setInterval(() => {
      setBalance(getBalance());
      setTransactions(getTransactions().slice(0, 3));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const OFFERS = [
    { id: 1, title: t("Flat ₹50 Cashback"), desc: t("On first bill payment"), icon: "🎟️", color: "from-orange-400 to-red-500" },
    { id: 2, title: t("20% Off Zomato"), desc: t("Use code TRUPAY20"), icon: "🍕", color: "from-blue-400 to-indigo-500" },
    { id: 3, title: t("Earn 2X Coins"), desc: t("On every Scan & Pay"), icon: "🪙", color: "from-yellow-400 to-amber-600" },
  ];

  return (
    <PhoneShell>
      {/* Premium Header */}
      <header className="px-5 pt-8 pb-4 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold shadow-glow hover:scale-105 transition-transform"
          >
            {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t("Good evening")}</p>
            <h1 className="text-lg font-display font-bold leading-tight">{userName}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate("/history")}
            className="p-3 rounded-2xl bg-secondary/50 text-muted-foreground hover:bg-secondary transition-all active:scale-90"
            title="Security Alerts"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button 
            onClick={() => navigate("/shield")}
            className="p-3 rounded-2xl bg-secondary/50 text-muted-foreground hover:bg-secondary transition-all active:scale-90"
            title="AI Sentinel Insights"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Glassmorphic Balance Card */}
      <div className="px-5 py-4 animate-slide-up">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-elevated">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <ShieldCheck className="w-40 h-40" />
          </div>
          <div className="relative space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t("UPI Linked")}</span>
              </div>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
              >
                {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">{t("Total Balance")}</p>
              <h2 className="text-4xl font-display font-bold tracking-tight tabular-nums">
                {showBalance ? `₹${balance.toLocaleString("en-IN")}` : "••••••"}
              </h2>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => navigate("/scan")}
                className="flex-1 bg-white text-primary py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                <Scan className="w-5 h-5" />
                {t("Scan QR")}
              </button>
              <button 
                onClick={() => navigate("/send")}
                className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-white/30 transition-all border border-white/20"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Shield Status Bar */}
      <div className="px-5 mb-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <button 
          onClick={() => navigate("/shield")}
          className="w-full flex items-center justify-between p-4 rounded-3xl bg-primary/5 border border-primary/10 hover:border-primary/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">{t("AI Shield Active")}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{t("Protected your account in real-time")}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-primary/40" />
        </button>
      </div>

      {/* Dynamic Offers Carousel */}
      <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="px-6 flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
            {t("Rewards & Offers")}
          </h3>
          <button 
            onClick={() => navigate("/rewards")}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
          >
            {t("View Store")}
          </button>
        </div>
        <div className="flex overflow-x-auto no-scrollbar gap-4 px-5 pb-6">
          {OFFERS.map((offer) => (
            <div 
              key={offer.id}
              className={cn(
                "min-w-[160px] p-5 rounded-[32px] bg-gradient-to-br shadow-lg flex flex-col justify-between h-[180px] hover:scale-105 transition-transform cursor-pointer",
                offer.color
              )}
            >
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/10">
                {offer.icon}
              </div>
              <div className="text-white">
                <p className="text-sm font-bold leading-tight mb-1">{offer.title}</p>
                <p className="text-[10px] text-white/70 font-medium leading-relaxed">{offer.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Activity List */}
      <section className="px-5 pb-24 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
            {t("Recent activity")}
          </h3>
          <button 
            onClick={() => navigate("/history")}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
          >
            {t("View all")}
          </button>
        </div>
        
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((t_item) => (
              <div 
                key={t_item.id}
                className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border hover:border-primary/20 transition-all shadow-card group"
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                  t_item.type === "sent" ? "bg-secondary text-foreground group-hover:bg-primary/5 group-hover:text-primary" : "bg-success/5 text-success group-hover:bg-success/10"
                )}>
                  {t_item.type === "sent" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{t_item.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{t_item.time}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-base font-display font-bold tabular-nums",
                    t_item.type === "sent" ? "text-foreground" : "text-success"
                  )}>
                    {t_item.type === "sent" ? "−" : "+"} ₹{t_item.amount.toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {t_item.shielded && <ShieldCheck className="w-2 h-2 text-primary" />}
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60">{t_item.status || "Success"}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center bg-secondary/30 rounded-[32px] border-2 border-dashed border-border">
              <History className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm font-bold text-muted-foreground">{t("No transactions yet")}</p>
              <p className="text-[10px] text-muted-foreground opacity-60 mt-1">{t("Your recent activity will appear here.")}</p>
            </div>
          )}
        </div>
      </section>

      <ProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </PhoneShell>
  );
};

export default Home;

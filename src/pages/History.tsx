import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, ShieldCheck, ShieldAlert, X, Share2, Info, ChevronRight, Copy } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { getTransactions } from "@/lib/transactions";
import { Transaction } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const History = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "sent" | "received" | "flagged">("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setTransactions(getTransactions());
  }, []);

  const isBlocked = (tx: Transaction) => 
    tx.status?.toLowerCase() === "blocked" || 
    tx.status?.toLowerCase() === "failed" ||
    tx.name.toLowerCase().includes("blocked") ||
    tx.name.toLowerCase().includes("fake");

  const filtered = transactions.filter(tx => {
    const matchesSearch = tx.name.toLowerCase().includes(search.toLowerCase());
    
    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "sent") return matchesSearch && tx.type === "sent" && !isBlocked(tx);
    if (activeFilter === "received") return matchesSearch && tx.type === "received" && !isBlocked(tx);
    if (activeFilter === "flagged") return matchesSearch && isBlocked(tx);
    
    return matchesSearch;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Transaction ID Copied");
  };

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "sent", label: "Sent" },
    { id: "received", label: "Received" },
    { id: "flagged", label: "Flagged", icon: <ShieldAlert className="w-3 h-3" /> }
  ] as const;

  return (
    <PhoneShell>
      <div className="flex flex-col h-full bg-background select-none">
        {/* Header */}
        <div className="shrink-0 px-6 pt-10 pb-4 bg-background z-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/home")}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-display font-black">History</h1>
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                showFilters ? "bg-primary text-white shadow-glow" : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="relative group mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 bg-secondary/50 border-none rounded-2xl pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
            />
          </div>

          {/* Expandable Filter Bar */}
          <div className={cn(
            "flex overflow-hidden transition-all duration-300 gap-2 no-scrollbar overflow-x-auto",
            showFilters ? "h-12 opacity-100 mb-2" : "h-0 opacity-0 mb-0"
          )}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border",
                  activeFilter === f.id 
                    ? "bg-primary border-primary text-white shadow-glow" 
                    : "bg-secondary border-transparent text-muted-foreground hover:bg-secondary/80"
                )}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-4">
          {filtered.map((tx, i) => (
            <div 
              key={tx.id}
              onClick={() => setSelectedTx(tx)}
              className="flex items-center justify-between p-4 rounded-3xl bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer animate-in fade-in duration-500"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg",
                  isBlocked(tx) ? "bg-red-500/10 text-red-500" : (tx.type === "sent" ? "bg-zinc-100 text-zinc-500" : "bg-emerald-500/10 text-emerald-500")
                )}>
                  {tx.name[0]}
                </div>
                <div>
                  <p className="font-bold text-sm">{tx.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{tx.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-display font-bold text-sm mb-1",
                  isBlocked(tx) ? "text-muted-foreground line-through opacity-50" : (tx.type === "sent" ? "text-foreground" : "text-emerald-500")
                )}>
                  {tx.type === "sent" ? "−" : "+"} ₹{tx.amount.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {isBlocked(tx) ? (
                    <div className="flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">
                      <ShieldAlert className="w-2.5 h-2.5 text-destructive" />
                      <p className="text-[7px] font-black uppercase tracking-[0.05em] text-destructive">Blocked</p>
                    </div>
                  ) : (
                    <>
                      {tx.shielded && <ShieldCheck className="w-2 h-2 text-primary" />}
                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 uppercase">{tx.status || "Success"}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ShieldAlert className="w-12 h-12 opacity-10 mb-4" />
              <p className="text-sm font-bold">No results found</p>
              <p className="text-[10px] font-medium opacity-50 px-10 text-center mt-2">Try adjusting your filters to see more transaction history.</p>
            </div>
          )}
        </div>

        {/* Transaction Detail Sheet */}
        {selectedTx && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            <div 
              className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setSelectedTx(null)}
            />
            
            <div className="relative w-full max-w-[440px] mx-auto bg-background rounded-t-[40px] border-t border-white/10 shadow-2xl p-8 animate-in fade-in duration-500">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
              
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mt-4">
                <div className={cn(
                  "w-20 h-20 rounded-[32px] flex items-center justify-center mb-6 shadow-xl",
                  isBlocked(selectedTx) ? "bg-destructive text-white" : "bg-emerald-500 text-white"
                )}>
                  {isBlocked(selectedTx) ? <ShieldAlert className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
                </div>

                <h2 className={cn(
                  "text-lg font-display font-black uppercase tracking-widest mb-1",
                  isBlocked(selectedTx) ? "text-destructive" : "text-muted-foreground"
                )}>
                  {isBlocked(selectedTx) ? "Transaction Blocked" : "Transaction Success"}
                </h2>
                <p className={cn(
                  "text-4xl font-display font-black mb-8 tabular-nums tracking-tighter",
                  isBlocked(selectedTx) && "text-muted-foreground opacity-50 line-through"
                )}>
                  ₹{selectedTx.amount.toLocaleString("en-IN")}
                </p>

                <div className="w-full space-y-6 bg-secondary/30 rounded-3xl p-6 border border-border/50">
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Recipient</p>
                      <p className="text-sm font-bold">{selectedTx.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Date & Time</p>
                      <p className="text-xs font-bold">{selectedTx.time}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 text-left">UPI Transaction ID</p>
                    <div className="flex items-center justify-between bg-background/50 p-3 rounded-xl border border-border/30">
                      <p className="text-xs font-mono font-bold tracking-wider">{selectedTx.id}</p>
                      <button 
                        onClick={() => copyToClipboard(selectedTx.id)}
                        className="p-1 hover:text-primary transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {selectedTx.shielded && (
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border",
                      isBlocked(selectedTx) 
                        ? "bg-destructive/5 border-destructive/20 text-destructive" 
                        : "bg-primary/5 border-primary/20 text-primary"
                    )}>
                      {isBlocked(selectedTx) ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                      <p className="text-[10px] font-black uppercase tracking-widest text-left leading-tight">
                        {isBlocked(selectedTx) ? "Blocked & Shielded by AI Sentinel" : "Verified & Shielded by AI Sentinel"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                  <button className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-secondary font-bold text-sm hover:bg-secondary/80 transition-all">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-secondary font-bold text-sm hover:bg-secondary/80 transition-all text-destructive">
                    <Info className="w-4 h-4" />
                    Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PhoneShell>
  );
};

export default History;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OnboardingPhone = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+91 ");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If phone already exists (from phone login), skip to bank
    const existingPhone = localStorage.getItem("trupay_user_phone");
    if (existingPhone) {
      navigate("/onboarding/bank", { replace: true });
    }
  }, [navigate]);

  const handleContinue = async () => {
    const cleanPhone = phone.replace(/\s+/g, "").trim();
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid mobile number.");
      return;
    }

    setLoading(true);

    // Give the cloud write a bounded window. Firestore can remain pending
    // indefinitely when the phone is offline or its rules reject the write;
    // local onboarding should still be able to continue.
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await wait(1500);
      localStorage.setItem("trupay_user_phone", cleanPhone);

      // Save to Cloud
      try {
        const { saveProfileToCloud } = await import("@/lib/userProfile");
        await Promise.race([
          saveProfileToCloud({ phone: cleanPhone }),
          wait(8000),
        ]);
      } catch (e) {
        console.warn("Cloud sync failed, continuing locally.");
      }

      toast.success("Mobile number linked to your vault! 🛡️");
      navigate("/onboarding/bank", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PhoneShell hideNav>
      <div className="h-full flex flex-col px-8 pt-20 pb-12 bg-background relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-8 shadow-inner border border-primary/20 animate-in zoom-in duration-500">
            <Phone className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-3xl font-display font-bold mb-3">Link your Mobile</h1>
          <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-12">
            Your phone number is the key to discovering your linked bank accounts.
          </p>

          <div className="w-full space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Mobile Number</label>
              <Input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-16 rounded-2xl border-primary/20 focus:border-primary text-xl font-bold bg-secondary/30"
              />
            </div>
            
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full h-16 rounded-[28px] bg-primary text-primary-foreground font-display font-black uppercase tracking-[0.2em] shadow-glow flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Binding Identity...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
          <ShieldCheck className="w-3.5 h-3.5" />
          Encrypted Sentinel Link
        </div>
      </div>
    </PhoneShell>
  );
};

export default OnboardingPhone;

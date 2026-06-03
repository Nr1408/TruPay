import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Loader2, ShieldCheck } from "lucide-react";
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { Input } from "@/components/ui/input";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { BACKEND_IP } from "@/config";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [showPhoneFlow, setShowPhoneFlow] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [userName, setUserName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const getOrCreateRecaptchaVerifier = async () => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized.");
    }

    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {
        // OTP flow continues after successful challenge.
      },
    });

    await verifier.render();
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      toast.error("Firebase is not configured. Add VITE_FIREBASE_* keys in .env.");
      return;
    }

    setLoading("google");
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();
      
      let user;
      if (isNative) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        
        if (result.user && auth) {
          const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(result.credential?.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          user = userCredential.user;
        }
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        user = result.user;
      }

      if (user) {
        // Check cloud for existing profile
        const { restoreProfileFromCloud } = await import("@/lib/userProfile");
        const existing = await restoreProfileFromCloud();
        
        if (existing && existing.name) {
          localStorage.setItem("trupay_user_name", existing.name);
          toast.success(`Welcome back, ${existing.name}!`);
          navigate("/home", { replace: true });
        } else {
          localStorage.setItem("trupay_user_name", user.displayName || "User");
          toast.success(`Welcome, ${user.displayName}!`);
          navigate("/onboarding/biometric");
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked' || error?.message?.includes('Cross-Origin-Opener-Policy')) {
        toast.error("Popup Blocked", {
          description: "Please enable popups or try a different browser for Google login."
        });
      } else {
        const message = error instanceof Error ? error.message : "Google sign-in failed.";
        toast.error(message);
      }
    } finally {
      setLoading(null);
    }
  };

  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  const handleSendOtp = async () => {
    const normalizedPhone = phoneNumber.replace(/\s+/g, "").trim();
    if (normalizedPhone.length < 10) {
      toast.error("Please enter a valid phone number.");
      return;
    }

    setLoading("phone");
    
    // Simulate network delay for realism
    setTimeout(() => {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setOtpCode("");
      setLoading(null);
      
      // Special Demo Logic: Show the OTP in a toast so the user knows it
      toast.success(`Demo OTP Sent: ${mockOtp}`, {
        duration: 8000,
        description: "In production, this would arrive via SMS.",
      });
      
      // Simulate that the OTP was "received" (using a dummy confirmation object to satisfy existing UI checks)
      setConfirmationResult({} as any);
    }, 1200);
  };

  const handleVerifyOtp = async () => {
    if (!generatedOtp) {
      toast.error("Please send OTP first.");
      return;
    }

    if (otpCode.trim() !== generatedOtp) {
      toast.error("Invalid OTP code. For demo, use: " + generatedOtp);
      return;
    }

    setLoading("otp");
    
    setTimeout(async () => {
      // 1. Check if user already exists in cloud
      const { restoreProfileFromCloud } = await import("@/lib/userProfile");
      const existingProfile = await restoreProfileFromCloud();

      if (existingProfile && existingProfile.name) {
        // RETURNING USER: Jump straight to home/vault
        toast.success(`Welcome back, ${existingProfile.name}! 🛡️`);
        localStorage.setItem("trupay_user_name", existingProfile.name);
        window.dispatchEvent(new Event("storage"));
        navigate("/home", { replace: true });
      } else {
        // NEW USER: Ask for name
        setShowNameInput(true);
        toast.success("Identity Verified Successfully! 🛡️");
      }
      setLoading(null);
    }, 800);
  };

  const checkConnectivity = async () => {
    try {
      const res = await fetch(`http://${BACKEND_IP}:5000/`);
      if (res.ok) toast.success("Connected to Sentinel Cloud!");
      else toast.error("Server responded with an error.");
    } catch (e: any) {
      toast.error("Cloud Unreachable", {
        description: `Check if your laptop is on this Wi-Fi and firewall is off. Error: ${e.message}`
      });
    }
  };

  const handleSaveName = async () => {
    if (!userName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    const name = userName.trim();
    localStorage.setItem("trupay_user_name", name);
    
    // Save to Cloud
    const { saveProfileToCloud } = await import("@/lib/userProfile");
    await saveProfileToCloud({ name });
    
    window.dispatchEvent(new Event("storage")); // Wake up the auth guard
    navigate("/onboarding/biometric");
  };

  return (
    <PhoneShell hideNav>
      <div className="h-full flex flex-col px-8 pt-20 pb-12 bg-background relative overflow-hidden">
        {/* Floating Health Check Button */}
        <div className="absolute top-0 right-0 p-4 z-[60]">
          <button 
            onClick={checkConnectivity}
            className="p-3 rounded-2xl bg-primary/5 text-primary/40 hover:bg-primary/10 transition-all active:scale-90 border border-primary/10"
            title="Sentinel Health Check"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32" />

        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 w-full">
          <div className="w-24 h-24 rounded-[32px] overflow-hidden mb-12 shadow-glow animate-in zoom-in duration-700">
            <img src="/trupay-logo.png" alt="TruPay" className="w-full h-full object-cover" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-6 leading-[1.1] animate-in fade-in duration-700 delay-100">
            {t("Experience the future of UPI.")}
          </h1>
          <p className="text-muted-foreground text-base max-w-[280px] leading-relaxed animate-in fade-in duration-700 delay-200">
            {t("Secure, AI-powered payments for the next billion users.")}
          </p>
        </div>

        <div className="space-y-5 relative z-10 animate-in fade-in duration-700 delay-300">
          {showNameInput ? (
            <div className="rounded-2xl border-2 border-primary/20 bg-card/80 backdrop-blur-xl px-6 py-8 space-y-6 animate-in zoom-in duration-500 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-12 -mt-12" />
               
               <div className="space-y-2 text-center">
                 <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                   <ShieldCheck className="w-8 h-8 text-primary" />
                 </div>
                 <h2 className="text-xl font-display font-black text-white">Verification Complete</h2>
                 <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Secure identity established</p>
               </div>

               <div className="space-y-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <label htmlFor="user-name" className="text-[10px] font-black uppercase tracking-widest text-primary">
                      Legal Name (For UPI Verification)
                    </label>
                    <Input
                      id="user-name"
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      className="h-14 border-primary/20 focus:border-primary text-lg font-semibold bg-zinc-900/50"
                    />
                  </div>
                  <button
                    onClick={handleSaveName}
                    className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] shadow-glow transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Set Up Sentinel 🛡️
                  </button>
               </div>
            </div>
          ) : (
            <>
              <button 
                onClick={handleGoogleLogin}
                className="w-full h-16 rounded-2xl bg-white border border-border flex items-center justify-center gap-3 font-bold text-black hover:bg-secondary transition-all shadow-sm active:scale-[0.98]"
              >
                {loading === "google" ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : (
                  <>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-full h-full">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c3.13 0 5.74-1.04 7.65-2.81l-3.57-2.77c-1.02.68-2.33 1.09-4.08 1.09-3.13 0-5.78-2.12-6.73-4.96l-3.69 2.87C3.51 20.25 7.45 23 12 23z" fill="#34A853"/>
                        <path d="M5.27 13.55c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38l-3.69-2.87C.86 7.43 0 9.12 0 10.92s.86 3.49 2.37 5.5l3.69-2.87z" fill="#FBBC05"/>
                        <path d="M12 4.19c1.7 0 3.22.58 4.42 1.71l3.32-3.32C17.74 1.13 15.13 0 12 0 7.45 0 3.51 2.75 1.58 6.77L5.27 9.64c.95-2.84 3.6-4.96 6.73-4.96z" fill="#EA4335"/>
                      </svg>
                    </div>
                    {t("Continue with Google")}
                  </>
                )}
              </button>

              <button 
                onClick={() => setShowPhoneFlow((prev) => !prev)}
                className="w-full h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center gap-3 font-bold shadow-glow transition-all hover:opacity-95 active:scale-[0.98]"
              >
                {loading === "phone" || loading === "otp" ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Phone className="w-5 h-5" />
                    {showPhoneFlow ? t("Hide Phone Login") : t("Continue with Phone")}
                  </>
                )}
              </button>

              {showPhoneFlow && (
                <div className="rounded-2xl border border-border bg-card/60 backdrop-blur px-4 py-4 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="phone-number" className="text-xs font-semibold text-muted-foreground">
                      Phone Number
                    </label>
                    <Input
                      id="phone-number"
                      type="tel"
                      placeholder="+919876543210"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      autoComplete="tel"
                    />
                  </div>

                  <button
                    onClick={handleSendOtp}
                    disabled={loading === "phone"}
                    className="w-full h-11 rounded-xl bg-primary/10 text-primary font-semibold border border-primary/20"
                  >
                    {loading === "phone" ? "Sending OTP..." : confirmationResult ? "Resend OTP" : "Send OTP"}
                  </button>

                  {confirmationResult && (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="otp-code" className="text-xs font-semibold text-muted-foreground">
                          OTP Code
                        </label>
                        <Input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit code"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                          autoComplete="one-time-code"
                        />
                      </div>

                      <button
                        onClick={handleVerifyOtp}
                        disabled={loading === "otp"}
                        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                      >
                        {loading === "otp" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Verify OTP
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-center text-muted-foreground px-8 pt-4">
            By continuing, you agree to TruPay's <span className="underline">Terms</span> and <span className="underline">Privacy Policy</span>.
          </p>
        </div>

        <div id="recaptcha-container" />
      </div>
    </PhoneShell>
  );
};

export default Login;

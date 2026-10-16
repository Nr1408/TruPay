import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { hasPinCredential } from "@/lib/pinSecurity";

type AuthStatus = "loading" | "authenticated" | "partial" | "unauthenticated";

const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse font-display font-bold uppercase tracking-widest">Checking Sentinel ID...</p>
    </div>
  </div>
);

const useAuthStatus = () => {
  const [status, setStatus] = useState<AuthStatus>(() => {
    return "loading";
  });

  useEffect(() => {
    const checkStatus = async (user?: User | null) => {
      const currentUser = user ?? auth?.currentUser;
      const hasName = !!localStorage.getItem("trupay_user_name");
      const hasPin = await hasPinCredential();
      const isFirebase = !!currentUser;

      if ((isFirebase || hasName) && hasPin) setStatus("authenticated");
      else if (isFirebase || hasName) setStatus("partial");
      else setStatus("unauthenticated");
    };

    if (!auth) {
      void checkStatus();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void checkStatus(user);
    });

    // Also listen for storage changes (for same-page updates)
    const handleStorage = () => { void checkStatus(auth?.currentUser); };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return status;
};

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStatus();
  const location = useLocation();

  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  const isOnboarding = location.pathname.startsWith("/onboarding");
  if (status === "partial" && !isOnboarding) {
    return <Navigate to="/onboarding/biometric" replace />;
  }

  if (status === "authenticated" && isOnboarding) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const status = useAuthStatus();

  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (status === "authenticated") {
    return <Navigate to="/home" replace />;
  }
  
  if (status === "partial") {
    return <Navigate to="/onboarding/biometric" replace />;
  }

  return <>{children}</>;
};

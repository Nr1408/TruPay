import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "./pages/Home.tsx";
import SendPage from "./pages/Send.tsx";
import Pay from "./pages/Pay.tsx";
import Risk from "./pages/Risk.tsx";
import Success from "./pages/Success.tsx";
import History from "./pages/History.tsx";
import Shield from "./pages/Shield.tsx";
import ScanQR from "./pages/ScanQR.tsx";
import Rewards from "./pages/Rewards.tsx";
import Settings from "./pages/Settings.tsx";
import Login from "./pages/Login.tsx";
import OnboardingBiometric from "./pages/OnboardingBiometric.tsx";
import OnboardingPhone from "./pages/OnboardingPhone.tsx";
import OnboardingBank from "./pages/OnboardingBank.tsx";
import OnboardingPin from "./pages/OnboardingPin.tsx";
import NotFound from "./pages/NotFound.tsx";

import { AppLock } from "./components/AppLock.tsx";
import { PublicOnlyRoute, RequireAuth } from "./components/AuthRoute.tsx";
import { initializeTheme } from "./lib/theme.ts";

const queryClient = new QueryClient();

// A layout wrapper that combines Auth requirements and the Global App Lock
const AuthenticatedLayout = () => (
  <RequireAuth>
    <AppLock>
      <Outlet />
    </AppLock>
  </RequireAuth>
);

const App = () => {
  useEffect(() => {
    initializeTheme();
    
    const setupNativeUI = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#09090b' });
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (e) {
        console.warn("Native StatusBar not available in browser.");
      }
    };
    setupNativeUI();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Onboarding Flow */}
            <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            
            {/* Onboarding Steps (Require Name Auth but not full PIN/Biometric lock yet) */}
            <Route element={<RequireAuth><Outlet /></RequireAuth>}>
              <Route path="/onboarding/biometric" element={<OnboardingBiometric />} />
              <Route path="/onboarding/phone" element={<OnboardingPhone />} />
              <Route path="/onboarding/bank" element={<OnboardingBank />} />
              <Route path="/onboarding/pin" element={<OnboardingPin />} />
            </Route>

            {/* Fully Protected App Section (Require Auth + App Lock) */}
            <Route element={<AuthenticatedLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/send" element={<SendPage />} />
              <Route path="/pay" element={<Pay />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/success" element={<Success />} />
              <Route path="/history" element={<History />} />
              <Route path="/shield" element={<Shield />} />
              <Route path="/scan" element={<ScanQR />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

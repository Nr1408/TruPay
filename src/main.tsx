import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./lib/i18n";
import App from "./App.tsx";
import { initializeAuthSession } from "@/lib/authSession";
import "./index.css";

// Register service worker for PWA
registerSW({ immediate: true });

const mountApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

// Wait for the first-install reset before mounting AuthRoute. This prevents a
// restored native Firebase session from briefly rendering the home screen.
initializeAuthSession()
  .catch(() => {
    // Auth still works without persistence setup, but token sync may be unavailable.
  })
  .finally(mountApp);

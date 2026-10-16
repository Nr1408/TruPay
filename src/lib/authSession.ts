import { auth } from "./firebase";
import { signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { clearPinCredential } from "./pinSecurity";
import { Capacitor } from "@capacitor/core";

const INSTALL_MARKER = "trupay_install_initialized_v1";

// These values belong to the local installation, not the user's cloud account.
// They must be reset on a genuinely fresh native install so a restored native
// Firebase session cannot skip the login/onboarding flow.
const LOCAL_INSTALL_KEYS = [
  "trupay_user_name",
  "trupay_user_phone",
  "trupay_bank_accounts",
  "trupay_transactions",
  "trupay_balance",
  "trupay_contacts_synced",
  "trupay_location_permission",
  "trupay_biometric_settings",
  "trupay_daily_limit",
];

const resetFreshNativeInstall = async () => {
  if (!Capacitor.isNativePlatform() || localStorage.getItem(INSTALL_MARKER)) {
    return;
  }

  // Sign out both Firebase JS and the Capacitor Firebase plugin. The cloud
  // profile is deliberately preserved; it will be restored after sign-in.
  if (auth) {
    await signOut(auth).catch(() => undefined);
  }

  try {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    await FirebaseAuthentication.signOut();
  } catch {
    // There may be no native session to sign out; that is safe to ignore.
  }

  LOCAL_INSTALL_KEYS.forEach((key) => localStorage.removeItem(key));
  await clearPinCredential();
  sessionStorage.clear();
  localStorage.setItem(INSTALL_MARKER, "1");
};

/**
 * Initializes the auth session persistence and listeners.
 */
export const initializeAuthSession = async () => {
  try {
    await resetFreshNativeInstall();
    if (auth) {
      // Ensure session persists across restarts
      await setPersistence(auth, browserLocalPersistence);
    }
    return true;
  } catch (error) {
    console.warn("Auth Session Initialization Warning:", error);
    return false;
  }
};

/**
 * Performs a full sign-out by clearing both Firebase session 
 * and local storage security markers (Name, PIN, etc.)
 */
export const signOutAndCleanup = async () => {
  try {
    // 1. Clear Firebase Auth
    if (auth) {
      await signOut(auth);
    }

    // 2. Clear Local Identity markers
    localStorage.removeItem("trupay_user_name");
    await clearPinCredential();
    
    // 3. Clear any session-specific UI states
    sessionStorage.clear();

    // 4. Wake up the auth guard to redirect to login
    window.dispatchEvent(new Event("storage"));

    return true;
  } catch (error) {
    console.error("Sign-out error:", error);
    throw error;
  }
};

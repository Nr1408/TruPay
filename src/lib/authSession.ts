import { auth } from "./firebase";
import { signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { clearPinCredential } from "./pinSecurity";

/**
 * Initializes the auth session persistence and listeners.
 */
export const initializeAuthSession = async () => {
  try {
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

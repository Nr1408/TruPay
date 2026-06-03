import { db, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface UserProfile {
  name: string;
  pin: string;
  biometricsEnabled: boolean;
  biometricType: "face" | "fingerprint";
}

/**
 * Saves the user's profile to the cloud (Firestore).
 */
export const saveProfileToCloud = async (profile: Partial<UserProfile>) => {
  if (!db || !auth?.currentUser) return;

  try {
    const userDoc = doc(db, "users", auth.currentUser.uid);
    // Get current data to merge
    const currentSnap = await getDoc(userDoc);
    const currentData = currentSnap.exists() ? currentSnap.data() : {};
    
    await setDoc(userDoc, {
      ...currentData,
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error("Cloud profile save error:", error);
    return false;
  }
};

/**
 * Loads the user's profile from the cloud and restores it to localStorage.
 */
export const restoreProfileFromCloud = async (): Promise<UserProfile | null> => {
  if (!db || !auth?.currentUser) return null;

  try {
    const userDoc = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDoc);

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      
      // Restore to local storage for instant offline access
      if (data.name) localStorage.setItem("trupay_user_name", data.name);
      if (data.pin) localStorage.setItem("trupay_pin", data.pin);
      
      return data;
    }
    return null;
  } catch (error) {
    console.error("Cloud profile restore error:", error);
    return null;
  }
};

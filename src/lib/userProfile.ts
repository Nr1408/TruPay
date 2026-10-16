import { db, auth } from "./firebase";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { createPinCredential, savePinCredential } from "./pinSecurity";

export interface UserProfile {
  name: string;
  pinHash: string;
  pinSalt: string;
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
    const safeProfile: Record<string, unknown> = {};
    for (const key of ["name", "pinHash", "pinSalt", "biometricsEnabled", "biometricType"] as const) {
      if (profile[key] !== undefined) safeProfile[key] = profile[key];
    }
    await setDoc(userDoc, {
      ...safeProfile,
      pin: deleteField(),
      updatedAt: new Date().toISOString(),
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
      const data = snap.data() as UserProfile & { pin?: string };

      // Migrate legacy plaintext PINs once, then remove them from Firestore.
      if ("pin" in data) {
        if (typeof data.pin === "string" && /^\d{4}$/.test(data.pin)) {
          const credential = await createPinCredential(data.pin);
          await setDoc(userDoc, {
            pinHash: credential.pinHash,
            pinSalt: credential.pinSalt,
            pin: deleteField(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          await savePinCredential(credential);
          return { name: data.name, biometricsEnabled: data.biometricsEnabled, biometricType: data.biometricType, ...credential } as UserProfile;
        }
        await setDoc(userDoc, { pin: deleteField(), updatedAt: new Date().toISOString() }, { merge: true });
        return null;
      }
      
      // Restore to local storage for instant offline access
      if (data.name) localStorage.setItem("trupay_user_name", data.name);
      if (data.pinHash && data.pinSalt) {
        await savePinCredential({ pinHash: data.pinHash, pinSalt: data.pinSalt });
      }
      
      return data;
    }
    return null;
  } catch (error) {
    console.error("Cloud profile restore error:", error);
    return null;
  }
};

import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export interface BiometricSettings {
  enabled: boolean;
  type: 'fingerprint';
}

const SETTINGS_KEY = 'trupay_biometric_settings';

export const getBiometricSettings = (): BiometricSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { enabled: Boolean(parsed.enabled), type: "fingerprint" };
    } catch {
      // Fallback
    }
  }
  return { enabled: false, type: 'fingerprint' };
};

export const setBiometricSettings = (settings: BiometricSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  const platform = Capacitor.getPlatform();
  
  if (platform !== 'web') {
    try {
      const result = await NativeBiometric.isAvailable({ useFallback: false });
      return result.isAvailable;
    } catch {
      return false;
    }
  }
  
  // Browser environments do not provide native fingerprint authentication.
  return false;
};

export const registerBiometric = async (_type: 'fingerprint' = 'fingerprint'): Promise<boolean> => {
  const platform = Capacitor.getPlatform();
  
  if (platform !== 'web') {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Register your fingerprint for TruPay security",
        title: "Fingerprint Enrollment",
        subtitle: "Secure your payments",
        description: "Use your fingerprint to authorize payments instantly.",
        useFallback: false,
        maxAttempts: 3,
      });
      return true;
    } catch (error) {
      console.error("Native biometric enrollment failed:", error);
      return false;
    }
  }

  // Never approve biometric authentication in a browser fallback.
  return false;
};

export const authenticateBiometric = async (_type: 'fingerprint' = 'fingerprint'): Promise<boolean> => {
  const platform = Capacitor.getPlatform();
  
  if (platform !== 'web') {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Verify your fingerprint to authorize payment",
        title: "Confirm with Fingerprint",
        subtitle: "Biometric Verification",
        description: "Please scan your fingerprint to proceed.",
        useFallback: false,
        maxAttempts: 3,
      });
      return true;
    } catch (error) {
      console.error("Native biometric auth failed:", error);
      return false;
    }
  }

  // Never approve biometric authentication in a browser fallback.
  return false;
};

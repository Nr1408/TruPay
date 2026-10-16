import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

const HASH_KEY = "trupay_pin_hash";
const SALT_KEY = "trupay_pin_salt";
const SECURE_SERVER = "com.trupay.ai.pin";
const ITERATIONS = 120_000;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

const deriveHash = async (pin: string, salt: Uint8Array) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material, 256);
  return toBase64(new Uint8Array(bits));
};

export interface PinCredential { pinHash: string; pinSalt: string; }
const isNative = () => Capacitor.isNativePlatform();

export const createPinCredential = async (pin: string): Promise<PinCredential> => {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must contain exactly 4 digits");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pinHash: await deriveHash(pin, salt), pinSalt: toBase64(salt) };
};

export const savePinCredential = async (credential: PinCredential) => {
  // Keep the derived credential available locally as a non-plaintext fallback.
  // The native secure store is still attempted first for Android devices.
  localStorage.setItem(HASH_KEY, credential.pinHash);
  localStorage.setItem(SALT_KEY, credential.pinSalt);

  if (isNative()) {
    try {
      await Promise.race([
        NativeBiometric.setCredentials({ server: SECURE_SERVER, username: "trupay-pin", password: JSON.stringify(credential) }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Native credential storage timed out")), 5000)),
      ]);
    } catch (error) {
      // Do not strand onboarding if the secure-storage plugin is unavailable.
      console.warn("Native PIN storage unavailable; using the salted local credential fallback.", error);
    }
  }
  localStorage.removeItem("trupay_pin");
};

const getStoredCredential = async (): Promise<PinCredential | null> => {
  try {
    if (isNative()) {
      try {
        const stored = await NativeBiometric.getCredentials({ server: SECURE_SERVER });
        return JSON.parse(stored.password) as PinCredential;
      } catch {
        // Fall through to the non-plaintext salted local credential.
      }
    }
    const pinHash = localStorage.getItem(HASH_KEY);
    const pinSalt = localStorage.getItem(SALT_KEY);
    return pinHash && pinSalt ? { pinHash, pinSalt } : null;
  } catch { return null; }
};

export const hasPinCredential = async () => Boolean(await getStoredCredential());

export const verifyPin = async (pin: string): Promise<boolean> => {
  const credential = await getStoredCredential();
  if (!credential) return false;
  return (await deriveHash(pin, fromBase64(credential.pinSalt))) === credential.pinHash;
};

export const clearPinCredential = async () => {
  if (isNative()) {
    try { await NativeBiometric.deleteCredentials({ server: SECURE_SERVER }); } catch { /* already absent */ }
  }
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem("trupay_pin");
};

// Keep the LAN address available for local development, but use the deployed
// Sentinel API by default so the phone works away from the development Wi-Fi.
export const BACKEND_IP = import.meta.env.VITE_BACKEND_IP || "192.168.29.184";
export const BACKEND_PORT = "5000";
export const SENTINEL_CLOUD_URL = "https://sentinel-nine-delta.vercel.app";
export const SENTINEL_API_URL =
  import.meta.env.VITE_SENTINEL_API_URL || SENTINEL_CLOUD_URL;
export const PREDICT_ENDPOINT = `${SENTINEL_API_URL}/predict`;
export const LATEST_ENDPOINT = `${SENTINEL_API_URL}/latest`;

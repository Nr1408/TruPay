// This is the development machine's LAN address. The phone and Sentinel
// dashboard must use the same address while connected to the same Wi-Fi.
export const BACKEND_IP = import.meta.env.VITE_BACKEND_IP || "192.168.29.184";
export const BACKEND_PORT = "5000";
export const SENTINEL_API_URL =
  import.meta.env.VITE_SENTINEL_API_URL || `http://${BACKEND_IP}:${BACKEND_PORT}`;
export const PREDICT_ENDPOINT = `${SENTINEL_API_URL}/predict`;
export const LATEST_ENDPOINT = `${SENTINEL_API_URL}/latest`;

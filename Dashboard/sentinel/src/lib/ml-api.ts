import type { Transaction } from "@/lib/fraud-mock";

export type PredictionLabel = 0 | 1;

// Keep this host aligned with the Capacitor app's LAN backend address.
// Override with VITE_SENTINEL_API_URL when the laptop's LAN IP changes.
const isLocalDashboard =
  typeof window === "undefined" ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const BASE_API_URL =
  import.meta.env.VITE_SENTINEL_API_URL ||
  (isLocalDashboard ? "http://192.168.29.184:5000" : window.location.origin);
export const HEARTBEAT_URL = `${BASE_API_URL}/`;
export const DEFAULT_PREDICT_URL = `${BASE_API_URL}/predict`;
export const LATEST_TRANSACTION_URL = `${BASE_API_URL}/latest`;
const BASE_API_HOST = new URL(BASE_API_URL).host;
export const API_CONNECTION_HELP_MESSAGE =
  `Check if Flask is running on ${BASE_API_HOST}.`;
export const NETWORK_ERROR_TOAST_MESSAGE =
  `Connection Failed: Unable to reach ${BASE_API_HOST}. Ensure your devices are on the same Wi-Fi and Flask is running.`;

export interface PredictRequestContext {
  id: string;
  upiId: string;
  amount: number;
}

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const CONNECTION_TIMEOUT_MS = 3500;

// Demo vector used by "Simulate Live Transaction" when no mobile client is connected.
export const SAMPLE_TRANSACTION_FEATURES: number[] = [
  0.0,
  0.82,
  1.0,
  1.0,
  0.21,
  0.91,
  1.0,
  0.09,
  0.88,
  0.16,
  0.74,
  0.93,
  1.0,
  1.0,
  1.0,
  1.0,
  1.0,
  1.0,
  0.72,
  0.88,
  0.69,
  1.0,
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalize = (value: number) => Number(clamp(value, 0, 1).toFixed(6));

const toBinary = (value: boolean) => (value ? 1 : 0);

export function transactionToFeatureVector(transaction: Transaction): number[] {
  const f = transaction.features;

  const vector = [
    toBinary(f.recipientBlacklisted),
    normalize(f.amountAnomaly),
    toBinary(f.locationMismatch),
    toBinary(f.vpnDetected),
    normalize(f.deviceTrust),
    normalize(f.behavioralAnomaly),
    toBinary(f.newRecipient),
    normalize(f.hourOfDay / 23),
    normalize(f.velocityScore),
    normalize(f.ipReputation),
    normalize(transaction.amount / 100000),
    normalize(transaction.riskScore / 100),
    toBinary(transaction.amount > 10000),
    toBinary(f.hourOfDay <= 5),
    toBinary(f.deviceTrust < 0.4),
    toBinary(f.behavioralAnomaly > 0.55),
    toBinary(f.velocityScore > 0.6),
    toBinary(f.ipReputation < 0.4),
    normalize(f.amountAnomaly * f.velocityScore),
    normalize((1 - f.deviceTrust) * f.behavioralAnomaly),
    normalize((1 - f.ipReputation) * f.amountAnomaly),
    toBinary(f.locationMismatch || f.vpnDetected),
  ];

  return vector;
}

function extractPredictionValue(data: unknown): unknown {
  if (typeof data === "number" || typeof data === "string") {
    return data;
  }

  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;

    if ("prediction" in payload) {
      return extractPredictionValue(payload.prediction);
    }

    if ("predictions" in payload) {
      return extractPredictionValue(payload.predictions);
    }

    if ("result" in payload) {
      return extractPredictionValue(payload.result);
    }
  }

  return undefined;
}

function toPredictionLabel(value: unknown): PredictionLabel {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (numeric === 0 || numeric === 1) {
    return numeric;
  }

  throw new Error("ML API returned an invalid prediction value.");
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown network error.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(request: () => Promise<Response>): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = toError(error);

      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries.");
}

function sanitizeFeatureArray(features: number[]): number[] {
  if (features.length !== 22) {
    throw new Error("Prediction payload must include exactly 22 numerical values.");
  }

  return features.map((value) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      throw new Error("Prediction payload contains invalid numerical values.");
    }

    return numeric;
  });
}

export async function testApiConnection(baseApiUrl = HEARTBEAT_URL): Promise<boolean> {
  await fetchWithRetry(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    try {
      const response = await fetch(baseApiUrl, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed with status ${response.status}.`);
      }

      return response;
    } finally {
      window.clearTimeout(timeout);
    }
  });

  return true;
}

export async function fetchLatestTransaction(
  latestUrl = LATEST_TRANSACTION_URL,
): Promise<unknown | null> {
  const response = await fetchWithRetry(async () => {
    const latestResponse = await fetch(latestUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (latestResponse.status === 204) {
      return latestResponse;
    }

    if (!latestResponse.ok) {
      throw new Error(
        `Latest endpoint responded with status ${latestResponse.status}.`,
      );
    }

    return latestResponse;
  });

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as unknown;
}

export async function predictFraud(
  features: number[],
  apiUrl: string,
  requestContext?: PredictRequestContext,
): Promise<PredictionLabel> {
  const cleanFeatures = sanitizeFeatureArray(features);
  const requestBody: Record<string, unknown> = {
    features: cleanFeatures,
  };

  if (requestContext) {
    requestBody.id = requestContext.id;
    requestBody.upiId = requestContext.upiId;
    requestBody.amount = requestContext.amount;
  }

  const response = await fetchWithRetry(async () => {
    const retryResponse = await fetch(apiUrl, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!retryResponse.ok) {
      throw new Error(`ML API responded with status ${retryResponse.status}.`);
    }

    return retryResponse;
  });

  const data: unknown = await response.json();
  const predictionValue = extractPredictionValue(data);
  return toPredictionLabel(predictionValue);
}

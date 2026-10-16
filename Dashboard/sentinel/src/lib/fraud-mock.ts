// SafePayAI mock data layer — 22-feature transaction generator + flow evaluator.

export type RiskLevel = "Low" | "Medium" | "High";

export interface Transaction {
  id: string;
  upiId: string;
  amount: number;
  timestamp: number;
  riskScore: number; // 0-100
  risk: RiskLevel;
  features: TransactionFeatures;
  scamType?: string;
}

export interface TransactionFeatures {
  recipientBlacklisted: boolean;
  amountAnomaly: number; // 0-1
  locationMismatch: boolean;
  vpnDetected: boolean;
  deviceTrust: number; // 0-1
  behavioralAnomaly: number; // 0-1
  newRecipient: boolean;
  hourOfDay: number;
  velocityScore: number;
  ipReputation: number;
}

export const FEATURE_IMPORTANCE: Array<{ name: string; weight: number; key: string }> = [
  { name: "Recipient Blacklist", weight: 0.182, key: "blacklist" },
  { name: "Transaction Amount", weight: 0.156, key: "amount" },
  { name: "Behavioral Biometrics", weight: 0.094, key: "behavior" },
  { name: "Location Mismatch", weight: 0.082, key: "location" },
  { name: "VPN / Proxy Detected", weight: 0.071, key: "vpn" },
  { name: "Device Trust Score", weight: 0.063, key: "device" },
  { name: "Velocity (1h)", weight: 0.054, key: "velocity" },
  { name: "New Recipient", weight: 0.048, key: "new_recipient" },
  { name: "IP Reputation", weight: 0.041, key: "ip" },
  { name: "Hour of Day", weight: 0.036, key: "hour" },
  { name: "Merchant Category", weight: 0.032, key: "mcc" },
  { name: "Recipient Age (days)", weight: 0.028, key: "age" },
  { name: "Avg Txn / Day", weight: 0.025, key: "avg" },
  { name: "Failed Attempts", weight: 0.022, key: "failed" },
  { name: "Session Duration", weight: 0.019, key: "session" },
  { name: "App Tampering Flag", weight: 0.017, key: "tamper" },
  { name: "SIM Swap Detected", weight: 0.015, key: "sim" },
  { name: "Network Type", weight: 0.013, key: "network" },
  { name: "Geo Velocity", weight: 0.011, key: "geo_velocity" },
  { name: "Battery Anomaly", weight: 0.008, key: "battery" },
  { name: "Keystroke Cadence", weight: 0.006, key: "keystroke" },
  { name: "Screen Recording Flag", weight: 0.004, key: "screen" },
];

const HANDLES = ["oksbi", "okhdfcbank", "okicici", "okaxis", "paytm", "ybl", "ibl"];
const NAMES = [
  "rahul", "priya", "amit", "sneha", "vikram", "anjali", "rohan", "kavya",
  "arjun", "neha", "suresh", "deepa", "manish", "pooja", "raj", "swati",
  "unknown_payee_47", "quickcash99", "refund_dept", "kyc_update_team",
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomUpiId(forceFraud = false) {
  const name = forceFraud
    ? rand(["unknown_payee_47", "quickcash99", "refund_dept", "kyc_update_team", "winner_lottery"])
    : rand(NAMES.slice(0, 16));
  return `${name}@${rand(HANDLES)}`;
}

export function generateTransaction(forceFraud = false): Transaction {
  const isFraud = forceFraud || Math.random() < 0.22;
  const upiId = randomUpiId(isFraud);
  const amount = isFraud
    ? Math.floor(8000 + Math.random() * 90000)
    : Math.floor(50 + Math.random() * 4500);

  const features: TransactionFeatures = {
    recipientBlacklisted: isFraud && Math.random() < 0.7,
    amountAnomaly: isFraud ? 0.7 + Math.random() * 0.3 : Math.random() * 0.4,
    locationMismatch: isFraud && Math.random() < 0.65,
    vpnDetected: isFraud && Math.random() < 0.55,
    deviceTrust: isFraud ? Math.random() * 0.4 : 0.6 + Math.random() * 0.4,
    behavioralAnomaly: isFraud ? 0.6 + Math.random() * 0.4 : Math.random() * 0.35,
    newRecipient: Math.random() < (isFraud ? 0.8 : 0.2),
    hourOfDay: isFraud ? Math.floor(Math.random() * 5) + 1 : 9 + Math.floor(Math.random() * 12),
    velocityScore: isFraud ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3,
    ipReputation: isFraud ? Math.random() * 0.4 : 0.7 + Math.random() * 0.3,
  };

  const riskScore = computeRiskScore(features);
  const risk: RiskLevel = riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";

  return {
    id: `txn_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    upiId,
    amount,
    timestamp: Date.now(),
    riskScore,
    risk,
    features,
  };
}

export function computeRiskScore(f: TransactionFeatures): number {
  let s = 0;
  if (f.recipientBlacklisted) s += 35;
  s += f.amountAnomaly * 22;
  if (f.locationMismatch) s += 12;
  if (f.vpnDetected) s += 10;
  s += (1 - f.deviceTrust) * 8;
  s += f.behavioralAnomaly * 10;
  if (f.newRecipient) s += 4;
  s += f.velocityScore * 6;
  s += (1 - f.ipReputation) * 5;
  return Math.min(100, Math.round(s));
}

export type NodeStatus = "idle" | "pending" | "pass" | "fail";

export interface FlowState {
  start: NodeStatus;
  blacklist: NodeStatus;
  location: NodeStatus;
  vpn: NodeStatus;
  behavior: NodeStatus;
  verdict: NodeStatus; // pass = SAFE, fail = FRAUD
}

export const IDLE_FLOW: FlowState = {
  start: "idle",
  blacklist: "idle",
  location: "idle",
  vpn: "idle",
  behavior: "idle",
  verdict: "idle",
};

export function evaluateFlow(t: Transaction): FlowState {
  const f = t.features;
  return {
    start: "pass",
    blacklist: f.recipientBlacklisted ? "fail" : "pass",
    location: f.locationMismatch ? "fail" : "pass",
    vpn: f.vpnDetected ? "fail" : "pass",
    behavior: f.behavioralAnomaly > 0.55 ? "fail" : "pass",
    verdict: t.risk === "High" ? "fail" : "pass",
  };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

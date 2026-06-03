export type TrustLevel = "trusted" | "new" | "risky";

export interface Contact {
  id: string;
  name: string;
  upi: string;
  initials: string;
  trust: TrustLevel;
  lastPaid?: string;
  scenarioId?: ScenarioId;
}

export type ScenarioId = "fake-handle" | "kyc-scam" | "refund-scam" | "qr-tamper";

export interface RiskRule {
  id: string;
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface AttackStep {
  step: number;
  title: string;
  description: string;
}

export interface ScamScenario {
  id: ScenarioId;
  scamType: string;
  tagline: string;
  riskScore: number; // 0-100
  aiSummary: string;
  rules: RiskRule[];
  attackFlow: AttackStep[];
  recommendation: string;
}

export const SCENARIOS: Record<ScenarioId, ScamScenario> = {
  "fake-handle": {
    id: "fake-handle",
    scamType: "Impersonation / Fake UPI Handle",
    tagline: "This handle mimics a known brand but is not verified.",
    riskScore: 94,
    aiSummary:
      "The payee UPI ID closely resembles a verified merchant handle but uses a lookalike domain. The account was created 3 days ago and has received 47 small inbound transfers from unrelated users — a pattern consistent with impersonation scams.",
    rules: [
      { id: "r1", label: "Lookalike handle", detail: "Handle 'amazonn-pay@ybI' uses character substitution (capital I instead of l).", severity: "high" },
      { id: "r2", label: "Account age < 7 days", detail: "VPA registered 3 days ago with no verified merchant KYC.", severity: "high" },
      { id: "r3", label: "Funnel pattern", detail: "47 small inbound credits from unrelated payers in 48 hours.", severity: "medium" },
      { id: "r4", label: "No prior interaction", detail: "You have never paid this handle before.", severity: "medium" },
    ],
    attackFlow: [
      { step: 1, title: "Bait", description: "Scammer posts a fake refund / cashback offer on social media." },
      { step: 2, title: "Lookalike VPA", description: "Victim is given an Amazon-lookalike UPI handle to pay a 'verification fee'." },
      { step: 3, title: "Payment", description: "Funds are instantly funneled out to mule accounts." },
      { step: 4, title: "Disappear", description: "Handle is abandoned within hours, untraceable." },
    ],
    recommendation: "Do not pay. Verify the merchant on the official app. Report this VPA to your bank.",
  },
  "kyc-scam": {
    id: "kyc-scam",
    scamType: "Fake KYC / Bank Verification",
    tagline: "No bank ever asks for payment to complete KYC.",
    riskScore: 97,
    aiSummary:
      "This payee was flagged 12 times in the last week for KYC-related fraud reports. The transaction amount (₹1) is a classic 'verification' lure used to install screen-sharing malware or harvest your UPI PIN.",
    rules: [
      { id: "r1", label: "Reported by 12 users", detail: "Community fraud reports filed against this VPA in past 7 days.", severity: "high" },
      { id: "r2", label: "₹1 'verification' pattern", detail: "Tiny amounts paired with KYC notes are a known social-engineering vector.", severity: "high" },
      { id: "r3", label: "Note matches scam template", detail: "Transaction note 'KYC Update' matches 89% of reported scam payments.", severity: "high" },
      { id: "r4", label: "Originated from unknown call", detail: "You added this payee within 5 minutes of an incoming unknown call.", severity: "medium" },
    ],
    attackFlow: [
      { step: 1, title: "Cold call", description: "Caller poses as your bank and warns your account will be blocked." },
      { step: 2, title: "Pressure", description: "Urgency tactics force a quick decision without verification." },
      { step: 3, title: "Token payment", description: "You're asked to pay ₹1 to 'verify' — this approves a much larger debit." },
      { step: 4, title: "Drain", description: "Once UPI PIN is captured, the full account balance is withdrawn." },
    ],
    recommendation: "End the call. No legitimate bank verification ever requires you to send money.",
  },
  "refund-scam": {
    id: "refund-scam",
    scamType: "Reverse Refund Trick",
    tagline: "You're sending money — not receiving it.",
    riskScore: 88,
    aiSummary:
      "The collect request flow has been inverted. You believe you are accepting a refund, but the UPI PIN you enter will debit ₹{amount} from your account. The payee VPA matches a known refund-scam cluster.",
    rules: [
      { id: "r1", label: "Direction mismatch", detail: "Payee initiated a 'collect' request masquerading as a refund.", severity: "high" },
      { id: "r2", label: "Cluster match", detail: "Payee VPA is part of a 23-account refund-scam ring.", severity: "high" },
      { id: "r3", label: "Unusual time", detail: "Request received at 11:47 PM — outside merchant hours.", severity: "medium" },
    ],
    attackFlow: [
      { step: 1, title: "Fake order issue", description: "Scammer claims your recent order needs a refund." },
      { step: 2, title: "Collect request", description: "You receive a UPI 'request' — looks like incoming money." },
      { step: 3, title: "PIN entry", description: "Entering your PIN authorizes a debit, not a credit." },
      { step: 4, title: "Loss", description: "Money leaves your account instantly." },
    ],
    recommendation: "UPI PIN is never required to RECEIVE money. Decline this request immediately.",
  },
  "qr-tamper": {
    id: "qr-tamper",
    scamType: "Tampered Merchant QR",
    tagline: "The QR you scanned was overlaid with a fraudulent one.",
    riskScore: 76,
    aiSummary:
      "The scanned QR resolves to a personal VPA, not the merchant's registered handle. The payee name on the QR ('SHOP NAME') does not match the bank-registered name on the destination account.",
    rules: [
      { id: "r1", label: "Personal VPA, not merchant", detail: "Destination is a P2P account, not a registered P2M merchant.", severity: "high" },
      { id: "r2", label: "Name mismatch", detail: "QR-displayed name differs from bank-registered name.", severity: "medium" },
      { id: "r3", label: "Geofence anomaly", detail: "Account is registered 1,400 km from the scan location.", severity: "medium" },
    ],
    attackFlow: [
      { step: 1, title: "Sticker overlay", description: "A fraudulent QR sticker is placed over the real merchant QR." },
      { step: 2, title: "Customer scans", description: "Customer assumes it's the shop's QR and scans normally." },
      { step: 3, title: "Personal account", description: "Money goes to the scammer's personal account, not the merchant." },
      { step: 4, title: "Merchant unaware", description: "Shop never receives payment; customer is blamed." },
    ],
    recommendation: "Always verify the merchant name shown by your UPI app before paying at a shop.",
  },
};

export const CONTACTS: Contact[] = [
  { id: "c1", name: "Aarav Sharma", upi: "aarav@okicici", initials: "AS", trust: "trusted", lastPaid: "2 days ago" },
  { id: "c2", name: "Priya Mehta", upi: "priya.m@okhdfc", initials: "PM", trust: "trusted", lastPaid: "Yesterday" },
  { id: "c3", name: "Mom", upi: "savita@oksbi", initials: "M", trust: "trusted", lastPaid: "Last week" },
  { id: "c4", name: "Amazonn Pay", upi: "amazonn-pay@ybI", initials: "AP", trust: "risky", scenarioId: "fake-handle" },
  { id: "c5", name: "SBI KYC Update", upi: "sbi.kyc.verify@paytm", initials: "SB", trust: "risky", scenarioId: "kyc-scam" },
  { id: "c6", name: "Flipkart Refund Desk", upi: "fk-refund.desk@axl", initials: "FR", trust: "risky", scenarioId: "refund-scam" },
  { id: "c7", name: "Chai Tapri (QR)", upi: "ramesh.kumar11@oksbi", initials: "CT", trust: "risky", scenarioId: "qr-tamper" },
  { id: "c8", name: "Rohan Iyer", upi: "rohan.iyer@okaxis", initials: "RI", trust: "new" },
  { id: "c9", name: "Neha K.", upi: "neha.k99@ibl", initials: "NK", trust: "new" },
];

export interface Transaction {
  id: string;
  name: string;
  type: "sent" | "received";
  amount: number;
  time: string;
  shielded?: boolean;
  status?: "success" | "blocked" | "failed";
}

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", name: "Priya Mehta", type: "sent", amount: 450, time: "Today, 2:14 PM", shielded: true },
  { id: "t2", name: "Salary — Acme Corp", type: "received", amount: 84000, time: "Yesterday, 10:02 AM" },
  { id: "t3", name: "Aarav Sharma", type: "sent", amount: 1200, time: "Yesterday, 8:30 PM", shielded: true },
  { id: "t4", name: "Blocked: Fake KYC", type: "sent", amount: 1, time: "2 days ago", shielded: true, status: "blocked" },
  { id: "t5", name: "Mom", type: "sent", amount: 5000, time: "3 days ago", shielded: true },
];

// Risk engine — scenario takes precedence, otherwise compute by trust + amount + time
export function computeRisk(contact: Contact, amount: number): { score: number; scenario?: ScamScenario } {
  if (contact.scenarioId) {
    return { score: SCENARIOS[contact.scenarioId].riskScore, scenario: SCENARIOS[contact.scenarioId] };
  }
  let score = 5;
  if (contact.trust === "new") score += 25;
  if (amount > 10000) score += 20;
  if (amount > 50000) score += 15;
  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) score += 10;
  return { score: Math.min(score, 60) };
}

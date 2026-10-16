import { 
  ShieldCheck, 
  Smartphone, 
  Key, 
  Monitor, 
  PhoneCall, 
  QrCode, 
  Trophy, 
  Briefcase, 
  Heart, 
  UserCircle2, 
  Repeat
} from "lucide-react";
import { cn } from "@/lib/utils";

const PATTERNS = [
  {
    id: "kyc",
    title: "KYC Expiry Scam",
    icon: Smartphone,
    steps: ["Attacker calls claiming KYC expired", "Victim shares OTP / installs app", "Unauthorized transfer initiated"],
    signals: ["New device login", "Immediate high-value transfer", "Location mismatch"],
    detection: "Triggered by Amount Anomaly + New Recipient + Late Hour"
  },
  {
    id: "screen",
    title: "Screen Share Scam",
    icon: Monitor,
    steps: ["Fraudster asks to install AnyDesk/TeamViewer", "Victim opens banking app", "Attacker sees UPI PIN"],
    signals: ["Screen recording active", "App tampering detected", "High velocity"],
    detection: "Triggered by Screen Recording Bit + App Integrity Violation"
  },
  {
    id: "collect",
    title: "Collect Request Fraud",
    icon: Repeat,
    steps: ["Attacker sends 'Collect' request", "Claims victim will 'receive' money", "Victim enters PIN and loses money"],
    signals: ["Unsolicited collect request", "Behavioral anomaly", "Merchant high risk"],
    detection: "Triggered by Behavioral Anomaly + Merchant Category"
  },
  {
    id: "care",
    title: "Fake Customer Care",
    icon: PhoneCall,
    steps: ["Victim finds fake number on Google", "Attacker asks for 'verification' fee", "Victim loses access to account"],
    signals: ["VPN detected", "VoIP number source", "Rapid sequence of txn"],
    detection: "Triggered by VPN Detected + IP Reputation"
  },
  {
    id: "qr",
    title: "QR Code Swap",
    icon: QrCode,
    steps: ["Attacker sends QR code via WhatsApp", "Claims scanning will credit money", "Victim scans and money is debited"],
    signals: ["Scan-to-pay via external link", "Device trust low", "High risk merchant"],
    detection: "Triggered by Device Trust + MCC Code 7299"
  },
  {
    id: "lottery",
    title: "Prize/Lottery Scam",
    icon: Trophy,
    steps: ["Victim told they won 25 Lakhs", "Asked to pay 'Processing Fee'", "Victim pays and attacker vanishes"],
    signals: ["First time recipient", "Amount mismatch", "Velocity high"],
    detection: "Triggered by New Recipient + Velocity Score"
  },
  {
    id: "job",
    title: "Job Offer Fraud",
    icon: Briefcase,
    steps: ["Fake LinkedIn/WhatsApp job offer", "Ask for 'Security Deposit' for laptop", "No job, money stolen"],
    signals: ["Recipient age < 5 days", "High amount anomaly", "Location mismatch"],
    detection: "Triggered by Recipient Age + Amount Anomaly"
  },
  {
    id: "romance",
    title: "Romance Scam",
    icon: Heart,
    steps: ["Trust built over weeks", "Emergency 'hospital' bill request", "Victim pays out of sympathy"],
    signals: ["Low velocity initially", "Sudden high amount", "Manual override needed"],
    detection: "Triggered by Amount Anomaly (Global mean deviation)"
  },
  {
    id: "impersonation",
    title: "Impersonation Fraud",
    icon: UserCircle2,
    steps: ["Posing as Army/Govt official", "Urgent 'Security' transfer needed", "Victim pressured by authority"],
    signals: ["Recipient blacklisted", "Behavioral anomaly (hesitation)", "High velocity"],
    detection: "Triggered by Recipient Blacklist + Behavioral Biometrics"
  },
  {
    id: "mule",
    title: "Money Mule Chains",
    icon: Key,
    steps: ["Victim offered 'work from home' job", "Ask to receive and forward money", "Victim becomes part of fraud chain"],
    signals: ["Circular payment patterns", "Rapid ingress/egress", "IP reputation bad"],
    detection: "Triggered by IP Reputation + Velocity Score"
  }
];

export function PatternLibrary() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Fraud Pattern Library</h2>
        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">10 ARCHETYPES</span>
      </div>
      
      <div className="space-y-3">
        {PATTERNS.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-lg border border-border bg-background/40 p-3 hover:border-primary/40 hover:bg-secondary/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <p.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-foreground mb-1">{p.title}</h3>
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Attack Flow</span>
                    <p className="text-[10px] text-foreground/80 leading-relaxed italic">
                      {p.steps.join(" → ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-cyan-400/80 uppercase tracking-wider">System Signals</span>
                      <ul className="list-disc list-inside text-[9px] text-muted-foreground">
                        {p.signals.map(s => <li key={s} className="truncate">{s}</li>)}
                      </ul>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-danger/80 uppercase tracking-wider">Detection Logic</span>
                      <p className="text-[9px] text-muted-foreground leading-tight">
                        {p.detection}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

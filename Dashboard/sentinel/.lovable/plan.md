
## SafePayAI — Security Command Center

A single-page, dark-themed analyst dashboard for visualizing UPI fraud detection in real time. Built with a custom SVG-based attack flow (no extra deps needed), Recharts for feature importance, and shadcn components for the rest.

### Layout (single route: `/`)

**Top Header bar**
- Shield icon + "SafePayAI — Security Command Center"
- Real-time status pill: animated green dot "Connected" / amber pulse "Searching"
- Live Feed counter: incrementing "1,247 transactions analyzed" with Activity icon
- Analyst avatar / session info on the right

**3-column responsive grid (collapses to stacked on mobile)**

**Left column — Live Transaction Feed (sidebar)**
- Vertical scrollable list of recent transactions
- Each card: UPI ID (e.g. `rahul@oksbi`), ₹ amount, timestamp, Risk Score badge (red "High" / green "Low" / amber "Medium"), and a small chevron to load it into the canvas
- New entries fade in at the top every few seconds (simulated stream)
- Click a transaction → its data drives the Attack Flow canvas

**Center column — Attack Flow Modeller (the hero)**
- Custom SVG node-graph (no React Flow dep) with 6 nodes laid out as a decision tree:
  1. Transaction Start
  2. Recipient Blacklist Check
  3. Location Analysis
  4. VPN Detection
  5. Behavioral Biometrics
  6. Final Verdict (Safe / Fraud)
- Each node: icon, title, status chip (Pass/Fail/Pending), micro-stat
- Edges: animated dashed lines. When fraud is detected on a path, the relevant edges + downstream nodes glow red with a pulsing stroke; safe paths glow emerald
- "Simulate Fraud" button (top-right of canvas) replays a red-path animation through the tree, ending in a red "FRAUD DETECTED" verdict node with shake effect
- "Reset" button to clear

**Right column — Insights + Actions (stacked)**
- **Feature Importance** card: horizontal Recharts bar chart of all 22 features sorted by weight. "Recipient Blacklist" and "Amount" highlighted in red as top contributors; remainder in muted slate
- **Analyst Action Panel** card: three full-width buttons
  - Manual Override (Mark as Safe) — emerald outline
  - Blacklist UPI ID — red filled
  - Generate Detection Rule — slate outline with Sparkles icon
- Toast confirmations on click (sonner)

### Visual system
- Dark zinc/slate palette: `#0a0a0b` bg, `#18181b` cards, `#27272a` borders, with cyan/emerald for safe states, red-500 for fraud, amber for warnings
- Mono font for UPI IDs and numeric values; sans for everything else
- Subtle grid background on the canvas, scanline shimmer on the status pill
- Lucide icons throughout: Shield, ShieldCheck, ShieldAlert, Activity, AlertTriangle, MapPin, Wifi, Fingerprint, Ban, CheckCircle2, Sparkles

### Interactions
- "Simulate Fraud" → animates a fraud transaction through the tree, updates the live feed with a new High-risk entry, flashes the verdict node
- Clicking any feed item → re-runs the flow with that transaction's parameters (deterministic mock outcomes)
- All data is mocked client-side (no backend) — generated transactions stream every 3s

### Files to create
- `src/routes/index.tsx` — assembles the dashboard
- `src/components/dashboard/Header.tsx`
- `src/components/dashboard/LiveFeed.tsx`
- `src/components/dashboard/AttackFlowCanvas.tsx` (SVG-based)
- `src/components/dashboard/FeatureImportance.tsx`
- `src/components/dashboard/ActionPanel.tsx`
- `src/lib/fraud-mock.ts` — transaction generator + 22-feature definitions + flow evaluator
- Update `src/styles.css` — set `.dark` as default on `<html>` and tune zinc palette

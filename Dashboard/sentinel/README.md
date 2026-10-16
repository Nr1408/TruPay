# Sentinel Flow Dashboard

A real-time fraud monitoring dashboard that consumes machine-learning predictions from a Flask API and visualizes risk flow, live feed updates, and connection health.

## Overview

This project provides a front-end dashboard for UPI fraud monitoring with:

- live transaction feed updates
- prediction-driven risk state (Fraud or Verified)
- polling of latest backend transaction updates
- connection health and reconnect UX
- fallback simulation flow for demo/testing

## Tech Stack

- React 19
- TypeScript
- Vite 7
- TanStack Router
- Tailwind CSS
- Sonner toasts

## Project Layout

- `src/routes/index.tsx`: dashboard orchestration, polling, prediction flow
- `src/lib/ml-api.ts`: backend URLs, request contract, retries, parsing
- `src/hooks/useFraudPrediction.ts`: prediction hook used by dashboard route
- `src/components/dashboard/*`: feed, header, attack flow canvas, action panel

## Prerequisites

- Node.js 18+
- npm 9+
- Flask API reachable on your LAN (default: port 5000)

## Install

```bash
npm install
```

## Run (Development)

Run the dashboard and expose it to devices on your Wi-Fi:

```bash
npm run dev -- --host 0.0.0.0 --port 5177
```

Open:

- Local: `http://localhost:5177/`
- LAN: `http://<your-lan-ip>:5177/`

## Build (Production)

```bash
npm run build
```

## Backend Integration

The dashboard expects a Flask API with these endpoints:

- `GET /` health endpoint
- `POST /predict` prediction endpoint
- `GET /latest` latest transaction endpoint

### Default Backend URLs

Configured in `src/lib/ml-api.ts`:

- `BASE_API_URL`
- `HEARTBEAT_URL`
- `DEFAULT_PREDICT_URL`
- `LATEST_TRANSACTION_URL`

Update those constants if your backend host/IP changes.

### Predict Request Contract

Dashboard sends a JSON object containing:

- `features`: array of exactly 22 numeric values
- `id`: transaction id
- `upiId`: UPI identifier
- `amount`: transaction amount

Example:

```json
{
  "id": "txn_001",
  "upiId": "demo@oksbi",
  "amount": 1599,
  "features": [
    0, 0.82, 1, 1, 0.21, 0.91, 1, 0.09, 0.88, 0.16, 0.74, 0.93, 1, 1, 1, 1, 1, 1, 0.72, 0.88, 0.69,
    1
  ]
}
```

### Predict Response Contract

The dashboard accepts prediction in any of these fields:

- `prediction`
- `predictions`
- `result`

Value must resolve to `0` or `1`.

### Latest Endpoint Contract

`GET /latest` can return:

- `204 No Content` when nothing is available
- JSON payload containing transaction data (supported wrappers include `latest`, `transaction`, `data`, or root object)

Recommended shape:

```json
{
  "latest": {
    "id": "txn_001",
    "upiId": "demo@oksbi",
    "amount": 1599,
    "timestamp": "2026-04-18T12:36:54.245184+00:00",
    "prediction": 1,
    "features": [
      0, 0.82, 1, 1, 0.21, 0.91, 1, 0.09, 0.88, 0.16, 0.74, 0.93, 1, 1, 1, 1, 1, 1, 0.72, 0.88,
      0.69, 1
    ]
  }
}
```

## LAN Demo Checklist

1. Run Flask on `0.0.0.0:5000`.
2. Ensure Windows firewall allows inbound TCP 5000.
3. Run dashboard with `--host 0.0.0.0` (example port 5177).
4. Ensure Windows firewall allows inbound TCP 5177 (if needed).
5. Keep all devices on the same Wi-Fi.
6. Share `http://<your-lan-ip>:5177/` with your friend.

## Troubleshooting

- If dashboard shows reconnecting: verify API host/IP in `src/lib/ml-api.ts`.
- If `/latest` is 204 repeatedly: no transaction has been posted yet.
- If prediction fails: verify request body contains 22 numeric feature values.
- If friend cannot open dashboard: check LAN IP, firewall, and VPN status.

## Available Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - production build (client + SSR)
- `npm run build:dev` - development-mode build
- `npm run lint` - run ESLint
- `npm run format` - run Prettier

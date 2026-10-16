import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestore = null;

function getDatabase() {
  if (firestore) return firestore;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  const app = getApps()[0] || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  firestore = getFirestore(app);
  return firestore;
}

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sentinel-Key",
  "Content-Type": "application/json",
});

const send = (res, status, body, origin) => {
  res.writeHead(status, corsHeaders(origin));
  res.end(body === null ? "" : JSON.stringify(body));
};

const authorized = (req) => {
  const expected = process.env.SENTINEL_API_KEY;
  return !expected || req.headers["x-sentinel-key"] === expected;
};

const predictionFor = (features, amount) => {
  const vector = Array.isArray(features) ? features.map(Number) : [];
  return vector.length >= 22 && (vector[0] >= 1 || vector[2] >= 1 || vector[3] >= 1 || vector[5] > 0.55 || vector[8] > 0.6 || vector[9] < 0.4 || amount > 10000) ? 1 : 0;
};

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return send(res, 204, null, origin);
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" }, origin);

  const route = req.url.split("?")[0].replace(/^\/api\/?/, "").replace(/^\//, "");
  if (route === "" && req.method === "GET") {
    const db = getDatabase();
    return send(res, 200, { status: "ok", service: "trupay-sentinel", persistence: db ? "firestore" : "not-configured" }, origin);
  }

  if (route === "latest" && req.method === "GET") {
    const db = getDatabase();
    if (!db) return send(res, 503, { error: "Firestore is not configured on Sentinel." }, origin);

    const snapshot = await db.collection("transactions").orderBy("timestamp", "desc").limit(1).get();
    if (snapshot.empty) return send(res, 204, null, origin);
    return send(res, 200, snapshot.docs[0].data(), origin);
  }

  if ((route === "predict" || route === "transaction") && req.method === "POST") {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = String(payload.id || `txn_${Date.now()}`);
    const amount = Number(payload.amount || 0);
    const features = Array.isArray(payload.features) ? payload.features.map(Number) : [];
    const prediction = payload.prediction === 0 || payload.prediction === 1 ? payload.prediction : predictionFor(features, amount);
    if (route === "predict") return send(res, 200, { prediction, id }, origin);
    if (route === "transaction") {
      const db = getDatabase();
      if (!db) return send(res, 503, { error: "Firestore is not configured on Sentinel." }, origin);

      const transaction = {
        id,
        upiId: String(payload.upiId || "mobile_transaction@upi"),
        amount,
        features,
        prediction,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      await db.collection("transactions").doc(id).set(transaction, { merge: true });
      return send(res, 200, { accepted: true, latest: transaction }, origin);
    }
  }
  return send(res, 404, { error: "Not found" }, origin);
}

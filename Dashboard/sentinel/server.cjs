const http = require("node:http");

const HOST = process.env.SENTINEL_HOST || "0.0.0.0";
const PORT = Number(process.env.SENTINEL_PORT || 5000);
let latestTransaction = null;
const pendingPredictions = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function send(response, status, body) {
  response.writeHead(status, corsHeaders());
  response.end(body === null ? "" : JSON.stringify(body));
}

function predictionFor(features, amount) {
  const vector = Array.isArray(features) ? features.map(Number) : [];
  const risky = vector.length >= 22 && (
    vector[0] >= 1 || vector[2] >= 1 || vector[3] >= 1 ||
    vector[5] > 0.55 || vector[8] > 0.6 || vector[9] < 0.4 || amount > 10000
  );
  return risky ? 1 : 0;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, null);
  if (request.url === "/" && request.method === "GET") {
    return send(response, 200, { status: "ok", service: "trupay-sentinel", hasLatest: Boolean(latestTransaction) });
  }
  if (request.url === "/latest" && request.method === "GET") {
    return latestTransaction ? send(response, 200, latestTransaction) : send(response, 204, null);
  }
  if ((request.url === "/predict" || request.url === "/transaction") && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const id = String(payload.id || `txn_${Date.now()}`);
      const amount = Number(payload.amount || 0);
      const features = Array.isArray(payload.features) ? payload.features.map(Number) : [];
      const prediction = payload.prediction === 0 || payload.prediction === 1
        ? payload.prediction
        : predictionFor(features, amount);

      if (request.url === "/predict") {
        pendingPredictions.set(id, prediction);
        return send(response, 200, { prediction, id });
      }

      latestTransaction = {
        id,
        upiId: String(payload.upiId || "mobile_transaction@upi"),
        amount,
        features,
        prediction,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      pendingPredictions.delete(id);
      return send(response, 200, { accepted: true, latest: latestTransaction });
    } catch (error) {
      return send(response, 400, { error: "Invalid JSON payload" });
    }
  }
  return send(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Sentinel API listening on http://${HOST}:${PORT}`);
});

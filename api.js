import { API_BASE_URL } from "./config.js";
import { getToken } from "./auth.js";

/*
 * KONTRAK API BACKEND (yang perlu kamu sediakan)
 * ------------------------------------------------
 * Semua request membawa header:  Authorization: Bearer <Firebase ID token>
 * Backend memverifikasi token itu dengan Firebase Admin SDK (verifyIdToken).
 *
 * GET {API_BASE_URL}/api/commodities
 *   -> [
 *        { "id": "beras", "name": "Beras", "unit": "kg", "icon": "🍚",
 *          "currentPrice": 14500, "changePct": 0.7 }
 *      ]
 *
 * GET {API_BASE_URL}/api/commodities/{id}/prediction
 *   -> {
 *        "id": "beras", "name": "Beras", "unit": "kg",
 *        "currentPrice": 14500,
 *        "predictedPrice": 14620,
 *        "predictionDate": "2026-10-28",
 *        "changePct": 0.83,
 *        "confidence": 0.87,            // opsional, 0..1
 *        "history": [ { "date": "2026-09-28", "price": 14300 }, ... ]  // urut lama -> baru
 *      }
 */

const USE_MOCK = !API_BASE_URL;

async function request(path) {
  const token = await getToken();
  const res = await fetch(API_BASE_URL + path, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Server mengembalikan status ${res.status}`);
  return res.json();
}

export async function fetchCommodities() {
  if (USE_MOCK) return mockCommodities();
  return request("/api/commodities");
}

export async function fetchPrediction(id) {
  if (USE_MOCK) return mockPrediction(id);
  return request(`/api/commodities/${encodeURIComponent(id)}/prediction`);
}

/* ---------------- DATA CONTOH (mode demo) ---------------- */

const CATALOG = [
  { id: "beras", name: "Beras", unit: "kg", icon: "🍚", base: 14500 },
  { id: "cabai-merah", name: "Cabai Merah", unit: "kg", icon: "🌶️", base: 45000 },
  { id: "cabai-rawit", name: "Cabai Rawit", unit: "kg", icon: "🔥", base: 60000 },
  { id: "bawang-merah", name: "Bawang Merah", unit: "kg", icon: "🧅", base: 38000 },
  { id: "bawang-putih", name: "Bawang Putih", unit: "kg", icon: "🧄", base: 36000 },
  { id: "minyak-goreng", name: "Minyak Goreng", unit: "liter", icon: "🛢️", base: 17500 },
  { id: "gula-pasir", name: "Gula Pasir", unit: "kg", icon: "🍬", base: 18000 },
  { id: "telur-ayam", name: "Telur Ayam", unit: "kg", icon: "🥚", base: 30000 },
  { id: "daging-ayam", name: "Daging Ayam", unit: "kg", icon: "🍗", base: 38000 },
  { id: "daging-sapi", name: "Daging Sapi", unit: "kg", icon: "🥩", base: 135000 },
];

function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function isoDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildSeries(item, days = 30) {
  const rand = rng(item.id);
  const volatility = item.id.startsWith("cabai") ? 0.035 : 0.01;
  let price = item.base;
  const history = [];
  for (let i = days - 1; i >= 0; i--) {
    price = Math.max(item.base * 0.6, price * (1 + (rand() - 0.5) * 2 * volatility));
    history.push({ date: isoDate(-i), price: Math.round(price / 50) * 50 });
  }
  const last = history[history.length - 1].price;
  const prev = history[history.length - 2].price;
  const trend = (last - prev) * 0.6 + (rand() - 0.5) * item.base * volatility;
  const predicted = Math.round((last + trend) / 50) * 50;
  return { history, last, prev, predicted };
}

async function mockCommodities() {
  await new Promise((r) => setTimeout(r, 250));
  return CATALOG.map((item) => {
    const s = buildSeries(item);
    return {
      id: item.id, name: item.name, unit: item.unit, icon: item.icon,
      currentPrice: s.last,
      changePct: +(((s.last - s.prev) / s.prev) * 100).toFixed(2),
    };
  });
}

async function mockPrediction(id) {
  await new Promise((r) => setTimeout(r, 350));
  const item = CATALOG.find((c) => c.id === id);
  if (!item) throw new Error("Bahan pokok tidak ditemukan");
  const s = buildSeries(item);
  return {
    id: item.id, name: item.name, unit: item.unit, icon: item.icon,
    currentPrice: s.last,
    predictedPrice: s.predicted,
    predictionDate: isoDate(1),
    changePct: +(((s.predicted - s.last) / s.last) * 100).toFixed(2),
    confidence: 0.82,
    history: s.history,
  };
}

// Client for the Fipe API (https://fipe.api.br, by Deivid Fortuna) — free vehicle price-table
// lookups. 500 requests/day without a token, 1000/day with one (VITE_FIPE_TOKEN).
const BASE = "https://fipe.parallelum.com.br/api/v2";

async function fipeGet(path) {
  const token = import.meta.env.VITE_FIPE_TOKEN;
  const headers = { accept: "application/json" };
  if (token) headers["X-Subscription-Token"] = token;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Fipe API ${res.status}`);
  return res.json();
}

// "R$ 330.358,00" -> 330358
export function parseFipePrice(str) {
  const digitsAndComma = String(str || "").replace(/[^\d,]/g, "");
  return Number(digitsAndComma.replace(",", ".")) || 0;
}

export function fipeGetBrands() {
  return fipeGet("/cars/brands");
}
export function fipeGetModels(brandCode) {
  return fipeGet(`/cars/brands/${brandCode}/models`);
}
export function fipeGetYears(brandCode, modelCode) {
  return fipeGet(`/cars/brands/${brandCode}/models/${modelCode}/years`);
}
export function fipeGetDetail(brandCode, modelCode, yearCode) {
  return fipeGet(`/cars/brands/${brandCode}/models/${modelCode}/years/${yearCode}`);
}

// Load test for Creads (staging): visitors browse the site and signed-in customers use the studio, without
// generating anything (no provider is called, nothing is spent). Ramps to 500 and spikes to 1.000 at once.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE;
const COOKIE = __ENV.COOKIE || "";
const pageMs = new Trend("page_ms", true);
const apiMs = new Trend("api_ms", true);
const serverErr = new Rate("server_errors");   // 5xx: the platform failing
const limited = new Rate("rate_limited");      // 429: our own anti-abuse limits (one test IP)

export const options = {
  scenarios: {
    visitantes: { executor: "ramping-vus", exec: "visitante", startVUs: 0, stages: [{ duration: "1m", target: 300 }, { duration: "2m", target: 300 }, { duration: "30s", target: 700 }, { duration: "1m", target: 700 }, { duration: "30s", target: 0 }] },
    clientes: { executor: "ramping-vus", exec: "cliente", startVUs: 0, stages: [{ duration: "1m", target: 200 }, { duration: "2m", target: 200 }, { duration: "30s", target: 300 }, { duration: "1m", target: 300 }, { duration: "30s", target: 0 }] },
  },
  thresholds: { server_errors: ["rate<0.01"], page_ms: ["p(95)<3000"], api_ms: ["p(95)<2000"] },
};

const headers = (extra = {}) => ({ headers: { "user-agent": "CreadsLoadTest/1.0", ...(__ENV.BYPASS ? { "x-vercel-protection-bypass": __ENV.BYPASS } : {}), ...extra } });
function hit(url, trend, params) {
  const r = http.get(url, params);
  trend.add(r.timings.duration);
  serverErr.add(r.status >= 500);
  limited.add(r.status === 429);
  check(r, { "no 5xx": (x) => x.status < 500 });
  return r;
}

export function visitante() {
  hit(`${BASE}/`, pageMs, headers());
  sleep(1 + Math.random() * 3);
  hit(`${BASE}/app`, pageMs, headers());
  sleep(1 + Math.random() * 3);
  hit(`${BASE}/terminos`, pageMs, headers());
  sleep(2 + Math.random() * 4);
}

export function cliente() {
  const p = headers({ cookie: COOKIE });
  hit(`${BASE}/app`, pageMs, p);
  sleep(1 + Math.random() * 2);
  hit(`${BASE}/app/automatico`, pageMs, p);
  sleep(1 + Math.random() * 2);
  hit(`${BASE}/api/credits`, apiMs, p);
  hit(`${BASE}/api/v1/anuncios`, apiMs, p);
  sleep(1 + Math.random() * 2);
  hit(`${BASE}/app/prompts`, pageMs, p);
  hit(`${BASE}/api/models`, apiMs, p);
  sleep(2 + Math.random() * 4);
}

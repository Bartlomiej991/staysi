// Wspólne funkcje serwera STAYSI: logowanie, wywołania Claude, koszty i limity.
// Klucze są tylko w zmiennych środowiskowych Vercel, nigdy w kodzie.
import { createClient } from "@supabase/supabase-js";

export const MODELS = {
  haiku: { id: "claude-haiku-5-5", input: 0.10, output: 0.50, cacheRead: 0.01 },
  sonnet: { id: "claude-sonnet-5-5", input: 2.00, output: 10.00, cacheRead: 0.10 }
}; // USD za milion tokenów

const DAILY_LESSON_LIMIT = 12;

export function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Sprawdza token z aplikacji i zwraca zalogowanego użytkownika
export async function getUser(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Zaloguj się ponownie.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  // Lista dozwolonych e-maili (zmienna ALLOWED_EMAILS w Vercel, rozdzielone przecinkami).
  // Gdy jest ustawiona, tylko te osoby mogą korzystać z Claude przez aplikację.
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes((data.user.email || "").toLowerCase())) {
    throw new HttpError(403, "To konto nie ma dostępu do STAYSI.");
  }
  return data.user;
}

// Pilnuje miesięcznego limitu użytkownika, limitu globalnego i dziennego limitu lekcji
export async function checkLimits(db, userId, purpose) {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { data: rows, error } = await db.from("usage").select("cost_usd,purpose,created_at")
    .eq("user_id", userId).gte("created_at", monthStart.toISOString());
  if (error) { console.error("usage select", error); throw new HttpError(500, `Nie udało się sprawdzić kosztów (${error.message}).`); }
  const spent = rows.reduce((a, r) => a + Number(r.cost_usd), 0);
  const { data: prof } = await db.from("profiles").select("budget_usd").eq("id", userId).single();
  const budget = Number(prof?.budget_usd ?? 5);
  if (spent >= budget) throw new HttpError(402, `Osiągnięto miesięczny limit ${budget} USD. Możesz go zmienić w zakładce Koszty.`);

  const globalCap = Number(process.env.MONTHLY_CAP_USD || 0);
  if (globalCap > 0) {
    const { data: all } = await db.from("usage").select("cost_usd").gte("created_at", monthStart.toISOString());
    const total = (all || []).reduce((a, r) => a + Number(r.cost_usd), 0);
    if (total >= globalCap) throw new HttpError(402, "Aplikacja osiągnęła miesięczny limit wydatków. Spróbuj w przyszłym miesiącu.");
  }

  if (purpose === "lesson") {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const lessonsToday = rows.filter(r => r.purpose === "lesson" && new Date(r.created_at) >= today).length;
    if (lessonsToday >= DAILY_LESSON_LIMIT) throw new HttpError(429, `Dzienny limit to ${DAILY_LESSON_LIMIT} lekcji. Wracaj jutro!`);
  }
  return { spent, budget };
}

// Jedno wywołanie Claude. Zwraca tekst i zapisuje koszt.
export async function claude(db, { userId, model = "haiku", system, messages, maxTokens = 1500, purpose, lang = null }) {
  const m = MODELS[model];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: m.id,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Claude API error", res.status, detail.slice(0, 500));
    throw new HttpError(502, "Claude chwilowo nie odpowiada. Spróbuj za moment.");
  }
  const data = await res.json();
  const u = data.usage || {};
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const cached = u.cache_read_input_tokens || 0;
  const outTok = u.output_tokens || 0;
  const cost = inTok / 1e6 * m.input + (u.cache_creation_input_tokens || 0) / 1e6 * m.input * 0.25
    + cached / 1e6 * m.cacheRead + outTok / 1e6 * m.output;
  await db.from("usage").insert({
    user_id: userId, model: m.id, purpose, lang,
    input_tokens: inTok + cached, output_tokens: outTok, cost_usd: cost
  });
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return { text, cost, stop: data.stop_reason };
}

// Wywołanie Claude, które musi zwrócić JSON. Gdy odpowiedź jest nieczytelna
// albo urwana, prosi Claude jeszcze raz (z większym limitem, jeśli trzeba).
export async function claudeJson(db, opts) {
  const first = await claude(db, opts);
  try { return parseJson(first.text); }
  catch {
    console.error("Nieczytelny JSON od Claude", first.stop, first.text.slice(0, 1500));
    const retry = await claude(db, {
      ...opts,
      maxTokens: Math.round((opts.maxTokens || 1500) * (first.stop === "max_tokens" ? 2 : 1.3)),
      messages: [...opts.messages,
        { role: "assistant", content: first.text || "(brak)" },
        { role: "user", content: "Your previous reply was not a valid, complete JSON object. Reply again with ONLY the complete JSON object: no markdown fences, no comments, no text before or after, straight double quotes for all keys and strings." }]
    });
    return parseJson(retry.text);
  }
}

// Wyciąga JSON z odpowiedzi modelu, także gdy jest otoczony tekstem
export function parseJson(text) {
  const clean = String(text || "").replace(/```(?:json)?/gi, "");
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new HttpError(502, "Claude zwrócił nieczytelną odpowiedź. Spróbuj ponownie.");
  const body = clean.slice(start, end + 1);
  try { return JSON.parse(body); } catch {}
  try { return JSON.parse(body.replace(/,\s*([}\]])/g, "$1")); } // przecinki przed nawiasem
  catch { throw new HttpError(502, "Claude zwrócił nieczytelną odpowiedź. Spróbuj ponownie."); }
}

export function send(res, status, body) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

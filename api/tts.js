// Lektor z chmury: Google Cloud Text-to-Speech, głosy Chirp 3 HD.
// Klucz GOOGLE_TTS_KEY jest tylko w Vercel. Telefon dostaje gotowe nagranie MP3.
import { admin, getUser, HttpError } from "../lib/server.js";

export const config = { maxDuration: 30 };

export const LANG_CODES = { de: "de-DE", en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", pl: "pl-PL" };
export const VOICES = { f: ["Aoede", "Kore", "Leda", "Zephyr"], m: ["Charon", "Puck", "Orus", "Fenrir"] };
// Darmowe 1 mln znaków miesięcznie (Chirp 3 HD). Zostawiamy zapas, żeby nigdy nie płacić.
const MONTHLY_CHARS = Number(process.env.TTS_MONTHLY_CHARS) > 0 ? Number(process.env.TTS_MONTHLY_CHARS) : 900000;

export function voiceName(lang, gender = "f", name = "") {
  const code = LANG_CODES[lang]; if (!code) throw new HttpError(400, "Ten język nie ma lektora z chmury.");
  const g = gender === "m" ? "m" : "f";
  const pick = VOICES[g].includes(name) ? name : VOICES[g][0];
  return `${code}-Chirp3-HD-${pick}`;
}

export default async function handler(req, res) {
  const fail = (status, msg) => { res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify({ error: msg })); };
  if (req.method !== "POST") return fail(405, "Użyj POST.");
  if (!process.env.GOOGLE_TTS_KEY) return fail(503, "Lektor z chmury nie jest skonfigurowany.");
  const db = admin();
  try {
    const user = await getUser(req, db);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const text = String(body.text || "").trim().slice(0, 1500);
    if (!text) return fail(400, "Brak tekstu.");
    const name = voiceName(body.lang, body.gender, body.voice);

    // Miesięczny limit znaków całej aplikacji (w tabeli usage: input_tokens = liczba znaków)
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { data: used } = await db.from("usage").select("input_tokens").eq("purpose", "tts").gte("created_at", monthStart.toISOString());
    const chars = (used || []).reduce((a, r) => a + (r.input_tokens || 0), 0);
    if (chars + text.length > MONTHLY_CHARS) return fail(429, "Wykorzystano miesięczny darmowy limit lektora. Czyta głos z telefonu.");

    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(process.env.GOOGLE_TTS_KEY)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: LANG_CODES[body.lang], name }, audioConfig: { audioEncoding: "MP3" } })
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.audioContent) { console.error("Google TTS", r.status, JSON.stringify(out).slice(0, 300)); return fail(502, "Lektor z chmury nie odpowiedział."); }

    await db.from("usage").insert({ user_id: user.id, model: "google-chirp3-hd", purpose: "tts", lang: body.lang || null, input_tokens: text.length, output_tokens: 0, cost_usd: 0 });
    const audio = Buffer.from(out.audioContent, "base64");
    res.statusCode = 200;
    res.setHeader("content-type", "audio/mpeg");
    res.setHeader("cache-control", "private, max-age=31536000, immutable");
    res.end(audio);
  } catch (e) {
    return fail(e.status || 500, e.status ? e.message : "Lektor z chmury nie zadziałał.");
  }
}

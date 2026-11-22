// Publiczna konfiguracja dla aplikacji. Klucz "anon" Supabase jest publiczny z założenia:
// dane chroni RLS w bazie. Klucz Claude i klucz service_role nigdy tu nie trafiają.
import { createHash } from "node:crypto";

// Właściciel aplikacji (OWNER_EMAIL, a bez niej pierwszy adres z ALLOWED_EMAILS).
// Wysyłamy tylko skrót SHA-256 adresu, nie sam adres: aplikacja porównuje go z adresem zalogowanej osoby.
export function ownerHash(env = process.env) {
  const email = (env.OWNER_EMAIL || (env.ALLOWED_EMAILS || "").split(",")[0] || "").trim().toLowerCase();
  return email ? createHash("sha256").update(email).digest("hex") : "";
}

export default function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=300");
  res.send(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    cloudVoice: !!process.env.GOOGLE_TTS_KEY,
    ownerHash: ownerHash()
  }));
}

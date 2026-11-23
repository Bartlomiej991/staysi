// STAYSI: kopia zapasowa całej bazy (uruchamia ją GitHub Actions raz w tygodniu).
// Pobiera wszystkie tabele aplikacji kluczem serwera, pakuje i szyfruje hasłem BACKUP_PASSWORD.
// Uruchomienie ręczne: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… BACKUP_PASSWORD=… node scripts/backup.mjs
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TABLES = ["profiles", "user_languages", "bank", "lessons", "grammar", "mistakes", "activity", "usage"];
const MAGIC = Buffer.from("STAYSI1");
const PAGE = 1000;

// Szyfrowanie AES-256-GCM, klucz z hasła przez scrypt. Format: STAYSI1 | sól 16 | iv 12 | tag 16 | dane
export function encrypt(buf, password) {
  if (!password || password.length < 12) throw new Error("Hasło do kopii (BACKUP_PASSWORD) musi mieć co najmniej 12 znaków.");
  const salt = randomBytes(16), iv = randomBytes(12), key = scryptSync(password, salt, 32);
  const c = createCipheriv("aes-256-gcm", key, iv), data = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), data]);
}
export function decrypt(file, password) {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("To nie jest plik kopii STAYSI.");
  let o = MAGIC.length; const salt = file.subarray(o, o += 16), iv = file.subarray(o, o += 12), tag = file.subarray(o, o += 16);
  const d = createDecipheriv("aes-256-gcm", scryptSync(password, salt, 32), iv); d.setAuthTag(tag);
  try { return Buffer.concat([d.update(file.subarray(o)), d.final()]); }
  catch { throw new Error("Złe hasło albo uszkodzony plik kopii."); }
}
export const pack = (obj, password) => encrypt(gzipSync(Buffer.from(JSON.stringify(obj))), password);
export const unpack = (file, password) => JSON.parse(gunzipSync(decrypt(file, password)).toString("utf8"));

// Wszystkie wiersze wszystkich tabel, stronami po 1000; brak tabeli (np. nieuruchomiony plik SQL) nie psuje kopii
export async function collect(db) {
  const out = { app: "STAYSI", version: 1, created_at: new Date().toISOString(), tables: {}, missing: [] };
  for (const t of TABLES) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(t).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) { if (/does not exist|schema cache|not find/i.test(error.message || "")) { out.missing.push(t); break; } throw new Error(`Tabela ${t}: ${error.message}`); }
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    if (!out.missing.includes(t)) out.tables[t] = rows;
  }
  return out;
}

async function main() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, BACKUP_PASSWORD: pass } = process.env;
  const miss = [["SUPABASE_URL", url], ["SUPABASE_SERVICE_ROLE_KEY", key], ["BACKUP_PASSWORD", pass]].filter(([, v]) => !v).map(([n]) => n);
  if (miss.length) throw new Error(`Brakuje sekretów w GitHub (Settings → Secrets and variables → Actions): ${miss.join(", ")}`);
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const data = await collect(db);
  const day = data.created_at.slice(0, 10), name = `staysi-kopia-${day}.enc`;
  mkdirSync("kopia", { recursive: true });
  const file = pack(data, pass);
  writeFileSync(`kopia/${name}`, file);
  const counts = Object.entries(data.tables).map(([t, r]) => `${t}: ${r.length}`).join(", ");
  console.log(`Kopia gotowa: ${name} (${Math.round(file.length / 1024)} KB). ${counts}${data.missing.length ? `. Brak tabel: ${data.missing.join(", ")}` : ""}`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `name=staysi-kopia-${day}\n`, { flag: "a" });
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch(e => { console.error("Kopia nie wyszła:", e.message); process.exit(1); });

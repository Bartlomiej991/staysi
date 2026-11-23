// STAYSI: odtworzenie danych z kopii zapasowej.
//   Podgląd (nic nie zmienia, zapisuje czytelny plik JSON obok kopii):
//     BACKUP_PASSWORD=… node scripts/restore.mjs staysi-kopia-2026-11-23.enc
//   Przywrócenie do bazy (USUWA obecne wiersze aplikacji i wstawia te z kopii):
//     SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… BACKUP_PASSWORD=… node scripts/restore.mjs plik.enc --restore --yes
//   Do nowego projektu Supabase (po ponownym założeniu konta) dodaj --uid <nowe id użytkownika z Authentication>.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { TABLES, unpack } from "./backup.mjs";

// Wiersze gotowe do wstawienia: bez kolumny id (baza nada nowe), z podmienionym użytkownikiem, jeśli trzeba
export function plan(data, newUid) {
  const out = {};
  for (const t of TABLES) {
    const rows = data.tables?.[t]; if (!rows) continue;
    out[t] = rows.map(r => {
      const x = { ...r };
      if (t === "profiles") { if (newUid) x.id = newUid; }
      else { delete x.id; if (newUid && "user_id" in x) x.user_id = newUid; }
      if (t === "lessons") x.state = null; // niedokończone lekcje z kopii nie wracają
      return x;
    });
  }
  return out;
}

export async function restore(db, data, newUid) {
  const rows = plan(data, newUid), report = [];
  // najpierw dzieci, profil na końcu (inne tabele nie zależą od profilu, ale tak jest czytelniej)
  for (const t of [...TABLES].reverse()) {
    if (!rows[t]) continue;
    if (t === "profiles") { for (const p of rows[t]) { const { error } = await db.from(t).upsert(p); if (error) throw new Error(`${t}: ${error.message}`); } report.push(`${t}: ${rows[t].length}`); continue; }
    const users = [...new Set(rows[t].map(r => r.user_id).filter(Boolean))];
    for (const u of users) { const { error } = await db.from(t).delete().eq("user_id", u); if (error) throw new Error(`${t}: ${error.message}`); }
    for (let i = 0; i < rows[t].length; i += 500) { const { error } = await db.from(t).insert(rows[t].slice(i, i + 500)); if (error) throw new Error(`${t}: ${error.message}`); }
    report.push(`${t}: ${rows[t].length}`);
  }
  return report;
}

// Tylko dane jednego użytkownika (aplikacja przywraca wyłącznie konto właściciela).
// Każda tabela obecna w kopii jest najpierw czyszczona dla tego użytkownika, nawet gdy w kopii jest pusta.
export function only(data, uid) {
  const tables = {};
  for (const [t, rows] of Object.entries(data.tables || {})) tables[t] = rows.filter(r => (t === "profiles" ? r.id : r.user_id) === uid);
  return { ...data, tables };
}
export async function restoreUser(db, data, uid) {
  const mine = only(data, uid), rows = plan(mine, uid), report = {};
  for (const t of [...TABLES].reverse()) {
    if (!rows[t]) continue;
    if (t === "profiles") { for (const p of rows[t]) { const { error } = await db.from(t).upsert(p); if (error) throw new Error(`${t}: ${error.message}`); } report[t] = rows[t].length; continue; }
    const { error: de } = await db.from(t).delete().eq("user_id", uid); if (de) throw new Error(`${t}: ${de.message}`);
    for (let i = 0; i < rows[t].length; i += 500) { const { error } = await db.from(t).insert(rows[t].slice(i, i + 500)); if (error) throw new Error(`${t}: ${error.message}`); }
    report[t] = rows[t].length;
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith("--") && !/^[0-9a-f-]{36}$/.test(a));
  const uid = args[args.indexOf("--uid") + 1] && args.includes("--uid") ? args[args.indexOf("--uid") + 1] : null;
  if (!file) throw new Error("Podaj plik kopii, np. node scripts/restore.mjs staysi-kopia-2026-11-23.enc");
  if (!process.env.BACKUP_PASSWORD) throw new Error("Ustaw BACKUP_PASSWORD (to samo hasło co w sekretach GitHub).");
  const data = unpack(readFileSync(file), process.env.BACKUP_PASSWORD);
  const counts = Object.entries(data.tables).map(([t, r]) => `${t}: ${r.length}`).join(", ");
  if (!args.includes("--restore")) {
    const out = file.replace(/\.enc$/, "") + ".json"; writeFileSync(out, JSON.stringify(data, null, 2));
    return console.log(`Kopia z ${data.created_at}. ${counts}.\nCzytelna wersja zapisana w ${out}. Nic w bazie nie zmieniono.`);
  }
  if (!args.includes("--yes")) throw new Error("Przywrócenie usuwa obecne dane aplikacji. Jeśli na pewno, dodaj --yes.");
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  console.log("Przywrócono: " + (await restore(db, data, uid)).join(", "));
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch(e => { console.error("Nie udało się:", e.message); process.exit(1); });

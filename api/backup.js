// STAYSI: kopie zapasowe w aplikacji (tylko konto właściciela).
// Kopie tygodniowe robi GitHub Actions w osobnym, PRYWATNYM repozytorium (np. login/staysi-kopie, plik .github/workflows/backup.yml)
// i trzyma je 90 dni jako zaszyfrowane pliki. Publiczne repozytorium aplikacji nie ma żadnych kopii.
// Ten endpoint: lista kopii, „zrób kopię teraz”, podgląd zawartości i przywrócenie.
// Przed każdym przywróceniem zapisuje kopię bieżącego stanu (tabela snapshots), żeby dało się to cofnąć.
// Zmienne w Vercel: GITHUB_TOKEN (dostęp tylko do repozytorium kopii, Actions: Read and write), GITHUB_REPO (np. login/staysi-kopie), BACKUP_PASSWORD.
import { inflateRawSync } from "node:zlib";
import { admin, getUser, HttpError } from "../lib/server.js";
import { collect, pack, unpack, TABLES } from "../scripts/backup.mjs";
import { only, restoreUser } from "../scripts/restore.mjs";

export const config = { maxDuration: 120 };
export const CONFIRM = "PRZYWRÓĆ";
const KEEP_SNAPSHOTS = 5;

export function isOwner(email, env = process.env) {
  const owner = (env.OWNER_EMAIL || (env.ALLOWED_EMAILS || "").split(",")[0] || "").trim().toLowerCase();
  return !owner || (email || "").toLowerCase() === owner;
}

// Pierwszy plik z archiwum ZIP (GitHub oddaje artefakt jako ZIP). Czytamy katalog centralny, bo rozmiary są tam zawsze.
export function unzipFirst(zip) {
  let e = zip.length - 22; while (e >= 0 && zip.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new HttpError(502, "Uszkodzone archiwum kopii.");
  const cd = zip.readUInt32LE(e + 16);
  if (zip.readUInt32LE(cd) !== 0x02014b50) throw new HttpError(502, "Uszkodzone archiwum kopii.");
  const method = zip.readUInt16LE(cd + 10), size = zip.readUInt32LE(cd + 20), local = zip.readUInt32LE(cd + 42);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), raw = zip.subarray(start, start + size);
  return method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
}

async function gh(path, init = {}) {
  const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new HttpError(503, "Kopie nie są jeszcze skonfigurowane: dodaj w Vercel GITHUB_TOKEN i GITHUB_REPO.");
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", ...(init.headers || {}) } });
  if (!r.ok) throw new HttpError(502, `GitHub odpowiedział ${r.status}. Sprawdź GITHUB_TOKEN (dostęp do repozytorium, Actions: Read and write).`);
  return r;
}
const counts = (data, uid) => Object.fromEntries(Object.entries(only(data, uid).tables).map(([t, r]) => [t, r.length]));

async function load(db, uid, src, id) {
  const pass = process.env.BACKUP_PASSWORD; if (!pass) throw new HttpError(503, "Dodaj w Vercel BACKUP_PASSWORD (to samo hasło co w GitHub).");
  if (src === "snap") {
    const { data, error } = await db.from("snapshots").select("data").eq("id", id).eq("user_id", uid).single();
    if (error || !data) throw new HttpError(404, "Nie ma takiej kopii.");
    return unpack(Buffer.from(data.data, "base64"), pass);
  }
  const zip = Buffer.from(await (await gh(`/actions/artifacts/${Number(id)}/zip`)).arrayBuffer());
  try { return unpack(unzipFirst(zip), pass); } catch (e) { throw new HttpError(400, e.message); }
}
async function current(db, uid) {
  const all = await collect(db);
  return only(all, uid);
}

export default async function handler(req, res) {
  const send = (s, o) => { res.statusCode = s; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  if (req.method !== "POST") return send(405, { error: "Użyj POST." });
  const db = admin();
  try {
    const user = await getUser(req, db);
    if (!isOwner(user.email)) throw new HttpError(403, "Kopie zapasowe są tylko dla właściciela aplikacji.");
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const uid = user.id;

    if (body.action === "list") {
      const [arts, runs, snaps] = await Promise.all([
        gh("/actions/artifacts?per_page=100").then(r => r.json()),
        gh("/actions/workflows/backup.yml/runs?per_page=1").then(r => r.json()).catch(() => ({})),
        db.from("snapshots").select("id,label,size,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(KEEP_SNAPSHOTS)
      ]);
      const list = (arts.artifacts || []).filter(a => a.name.startsWith("staysi-kopia-") && !a.expired)
        .map(a => ({ id: a.id, name: a.name, size: a.size_in_bytes, created_at: a.created_at, expires_at: a.expires_at }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const run = runs.workflow_runs?.[0];
      return send(200, { list, snaps: snaps.error ? [] : snaps.data || [], snapsReady: !snaps.error,
        last: run ? { status: run.status, conclusion: run.conclusion, created_at: run.created_at, url: run.html_url } : null });
    }
    if (body.action === "run") {
      await gh("/actions/workflows/backup.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: body.ref || "main" }) });
      return send(200, { ok: true });
    }
    if (body.action === "preview") {
      const data = await load(db, uid, body.src, body.id), now = await current(db, uid);
      return send(200, { created_at: data.created_at, backup: counts(data, uid), now: Object.fromEntries(Object.entries(now.tables).map(([t, r]) => [t, r.length])) });
    }
    if (body.action === "restore") {
      if (body.confirm !== CONFIRM) throw new HttpError(400, `Wpisz ${CONFIRM}, żeby potwierdzić.`);
      const data = await load(db, uid, body.src, body.id);
      if (!Object.keys(only(data, uid).tables).length || !only(data, uid).tables.profiles?.length) throw new HttpError(400, "W tej kopii nie ma danych Twojego konta. Nic nie zmieniono.");
      // kopia bezpieczeństwa obecnego stanu: bez niej nie przywracamy
      const now = await current(db, uid), file = pack(now, process.env.BACKUP_PASSWORD);
      const label = `Stan sprzed przywrócenia kopii z ${new Date(data.created_at).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}`;
      const { data: snap, error: se } = await db.from("snapshots").insert({ user_id: uid, label, size: file.length, data: file.toString("base64") }).select("id").single();
      if (se) throw new HttpError(503, "Nie udało się zapisać kopii bezpieczeństwa, więc niczego nie zmieniono. Uruchom w Supabase plik 008_kopie.sql.");
      const report = await restoreUser(db, data, uid);
      // zostawiamy tylko kilka ostatnich kopii bezpieczeństwa
      const { data: old } = await db.from("snapshots").select("id").eq("user_id", uid).order("created_at", { ascending: false });
      for (const o of (old || []).slice(KEEP_SNAPSHOTS)) await db.from("snapshots").delete().eq("id", o.id);
      return send(200, { ok: true, report, snapshot: snap.id });
    }
    throw new HttpError(400, "Nieznana akcja.");
  } catch (e) {
    if (!(e instanceof HttpError)) console.error("backup", e);
    return send(e.status || 500, { error: e instanceof HttpError ? e.message : `Coś poszło nie tak: ${e.message}` });
  }
}
export { TABLES };

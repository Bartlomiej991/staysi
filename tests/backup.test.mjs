// Kopie zapasowe: szyfrowanie, zbieranie danych, ZIP z GitHuba, przywracanie tylko konta właściciela i ekran z potwierdzeniem
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { pack, unpack, encrypt, decrypt, collect, TABLES } from "../scripts/backup.mjs";
import { plan, restoreUser, only } from "../scripts/restore.mjs";
import { unzipFirst, isOwner, CONFIRM } from "../api/backup.js";
import { boot, db, click, type, text, $, backupCalls } from "./harness.mjs";

const PASS = "bardzo-dlugie-haslo-1";

test("kopia jest zaszyfrowana i otwiera się tylko właściwym hasłem", () => {
  const data = { tables: { bank: [{ id: 1, chunk: "der Hund" }] } };
  const file = pack(data, PASS);
  assert.ok(!file.toString("latin1").includes("der Hund"), "w pliku nie widać treści");
  assert.deepEqual(unpack(file, PASS), data);
  assert.throws(() => unpack(file, "zle-haslo-123456"), /Złe hasło/);
  assert.throws(() => encrypt(Buffer.from("x"), "krotkie"), /co najmniej 12/);
  assert.throws(() => decrypt(Buffer.from("cos innego"), PASS), /To nie jest plik kopii/);
});

// prosta atrapa Supabase dla skryptów (zakresy stron, usuwanie, wstawianie)
function fakeDb(tables, missing = []) {
  return { from(t) {
    const q = { f: [], op: "select", p: null, r: null,
      select() { return q; }, order() { return q; }, range(a, b) { q.r = [a, b]; return q; }, eq(k, v) { q.f.push(x => x[k] === v); return q; },
      delete() { q.op = "delete"; return q; }, insert(p) { q.op = "insert"; q.p = p; return q; }, upsert(p) { q.op = "upsert"; q.p = p; return q; },
      then(res) {
        if (missing.includes(t)) return res({ data: null, error: { message: `relation "public.${t}" does not exist` } });
        const rows = tables[t] = tables[t] || [];
        if (q.op === "delete") { tables[t] = rows.filter(x => !q.f.every(f => f(x))); return res({ error: null }); }
        if (q.op === "insert") { for (const x of [].concat(q.p)) { assert.ok(!("id" in x), "przy wstawianiu baza nadaje nowe id"); rows.push({ id: rows.length + 1000, ...x }); } return res({ error: null }); }
        if (q.op === "upsert") { const i = rows.findIndex(x => x.id === q.p.id); if (i >= 0) rows[i] = q.p; else rows.push(q.p); return res({ error: null }); }
        return res({ data: rows.slice(q.r[0], q.r[1] + 1), error: null });
      } };
    return q; } };
}

test("kopia zbiera wszystkie wiersze stronami i nie psuje się bez tabeli", async () => {
  const bank = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, user_id: "u1", chunk: "w" + i }));
  const data = await collect(fakeDb({ bank, profiles: [{ id: "u1" }] }, ["activity"]));
  assert.equal(data.tables.bank.length, 2500, "3 strony po 1000");
  assert.deepEqual(data.missing, ["activity"]);
  assert.deepEqual(Object.keys(data.tables).sort(), TABLES.filter(t => t !== "activity").sort());
});

test("przywracanie: tylko dane właściciela, inne konta nietknięte, puste tabele z kopii czyszczą obecne", async () => {
  const backup = { tables: { profiles: [{ id: "u1", name: "Bartek" }, { id: "u2", name: "Obcy" }], bank: [{ id: 5, user_id: "u1", chunk: "stare" }, { id: 6, user_id: "u2", chunk: "obce" }], grammar: [] } };
  const live = { profiles: [{ id: "u1", name: "Zmienione" }], bank: [{ id: 9, user_id: "u1", chunk: "nowe" }, { id: 10, user_id: "u2", chunk: "cudze" }], grammar: [{ id: 3, user_id: "u1", title: "x" }] };
  const report = await restoreUser(fakeDb(live), backup, "u1");
  assert.deepEqual(live.bank.map(b => b.chunk).sort(), ["cudze", "stare"], "moje: z kopii, cudze: bez zmian");
  assert.equal(live.profiles[0].name, "Bartek"); assert.equal(live.grammar.length, 0);
  assert.equal(report.bank, 1);
  assert.deepEqual(Object.keys(only(backup, "u1").tables.profiles), ["0"]);
  const p = plan({ tables: { lessons: [{ id: 1, user_id: "old", state: { C: 1 } }] } }, "new");
  assert.equal(p.lessons[0].user_id, "new"); assert.equal(p.lessons[0].state, null, "niedokończone lekcje nie wracają");
});

// minimalny ZIP jak z GitHuba (jeden plik, deflate)
function zip(name, data) {
  const comp = deflateRawSync(data), n = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(0, 18); lh.writeUInt16LE(n.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(0, 42);
  const off = 30 + n.length + comp.length, eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + n.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([lh, n, comp, cd, n, eo]);
}
test("plik z artefaktu GitHub (ZIP) da się otworzyć i odszyfrować", () => {
  const file = pack({ tables: { bank: [] }, created_at: "2026-11-23T02:17:00Z" }, PASS);
  assert.equal(unpack(unzipFirst(zip("staysi-kopia-2026-11-23.enc", file)), PASS).created_at, "2026-11-23T02:17:00Z");
});

test("kopie są tylko dla właściciela", () => {
  assert.ok(isOwner("bartek@x.pl", { ALLOWED_EMAILS: "Bartek@x.pl,ania@x.pl" }));
  assert.ok(!isOwner("ania@x.pl", { ALLOWED_EMAILS: "bartek@x.pl,ania@x.pl" }));
  assert.ok(isOwner("ania@x.pl", { OWNER_EMAIL: "ania@x.pl", ALLOWED_EMAILS: "bartek@x.pl" }));
  assert.equal(CONFIRM, "PRZYWRÓĆ");
});

before(async () => {
  db.profiles[0] = { ...db.profiles[0], name: "Bartek", onboarded: true, interests: ["Sport"], goal: "Praca" };
  db.user_languages.push({ id: 701, user_id: "u1", lang: "de", score: 47, lessons_done: 3, difficulty_shift: 0 });
  globalThis.__backup = b => b.action === "list" ? { list: [{ id: 77, name: "staysi-kopia-2026-11-22", size: 420000, created_at: "2026-11-22T02:17:00Z", expires_at: new Date(Date.now() + 80 * 864e5).toISOString() }], snaps: [], last: { status: "completed", conclusion: "success", created_at: "2026-11-22T02:17:00Z" } }
    : b.action === "preview" ? { created_at: "2026-11-22T02:17:00Z", backup: { bank: 120, lessons: 14 }, now: { bank: 131, lessons: 15 } }
    : b.action === "restore" ? { ok: true, report: { bank: 120, lessons: 14 }, snapshot: 1 } : { ok: true };
  await boot();
});

test("ekran kopii: lista, „Zrób kopię teraz” i przywracanie dopiero po wpisaniu PRZYWRÓĆ", async () => {
  await click('[data-act="tab"][data-k="me"]');
  await click('[data-act="openBackup"]', 60);
  assert.match(text(), /Kopie zapasowe/); assert.match(text(), /niedziela, 22 listopada/); assert.match(text(), /410 KB|411 KB/);
  assert.match(text(), /udana/);
  await click('[data-act="bkRun"]', 20); assert.equal(backupCalls.at(-1).action, "run");
  await click('[data-act="bkPick"]', 60);
  assert.match(text(), /Przywrócić kopię\?/); assert.match(text(), /W kopii/); assert.match(text(), /Stan sprzed przywrócenia/, "wyjaśnienie, jak cofnąć");
  await click('[data-act="bkRestore"]', 40);
  assert.ok(!backupCalls.some(c => c.action === "restore"), "bez wpisania nic się nie dzieje");
  assert.match(text(), /Wpisz PRZYWRÓĆ, żeby potwierdzić/);
  await type("#bkConfirm", "przywroc"); await click('[data-act="bkRestore"]', 40);
  assert.ok(!backupCalls.some(c => c.action === "restore"), "literówka też nie przechodzi");
  await type("#bkConfirm", "PRZYWRÓĆ"); await click('[data-act="bkRestore"]', 80);
  assert.equal(backupCalls.at(-1).action, "restore"); assert.equal(backupCalls.at(-1).confirm, "PRZYWRÓĆ");
  assert.match(text(), /Przywrócone/);
});


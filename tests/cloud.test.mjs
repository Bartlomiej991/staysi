// Lektor z chmury: postacie dostają głos według płci, a błąd chmury nie psuje czytania.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { boot, db, ttsBodies, spoken, click, text, sleep, $ } from "./harness.mjs";
import { voiceName } from "../api/tts.js";

let w;
before(async () => {
  globalThis.__cloud = true;
  db.profiles[0] = { ...db.profiles[0], name: "Bartek", name_vocative: "Bartku", onboarded: true, interests: ["Sport"], goal: "Praca" };
  db.user_languages.push({ id: 900, user_id: "u1", lang: "de", score: 22, lessons_done: 0, difficulty_shift: 0 });
  w = await boot();
  w.HTMLMediaElement.prototype.play = function () { setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  globalThis.URL.createObjectURL = () => "blob:x"; globalThis.URL.revokeObjectURL = () => {};
});

test("nazwy głosów Google dla języków i płci", () => {
  assert.equal(voiceName("de", "f"), "de-DE-Chirp3-HD-Aoede");
  assert.equal(voiceName("en", "m", "Puck"), "en-GB-Chirp3-HD-Puck");
  assert.equal(voiceName("it", "m", "NieMaTakiego"), "it-IT-Chirp3-HD-Charon", "nieznany głos = domyślny");
});

test("w dialogu kobieta i mężczyzna dostają różne głosy z chmury", async () => {
  await click('[data-act="openLang"][data-k="de"]');
  await click('[data-act="start"][data-k="de"]'); await click('[data-act="time"][data-k="10"]', 80);
  await click('[data-act="matNext"]'); await click('[data-act="matNext"]');
  ttsBodies.length = 0;
  await click('[data-act="playAll"]', 300);
  assert.deepEqual(ttsBodies.slice(0, 2).map(b => [b.gender, b.voice]), [["f", "Aoede"], ["m", "Charon"]]);
  assert.equal(ttsBodies[0].lang, "de");
});

test("gdy chmura zawiedzie, czyta głos z telefonu", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opt) => url === "/api/tts" ? { ok: false, json: async () => ({ error: "Lektor z chmury nie odpowiedział." }) } : orig(url, opt);
  spoken.length = 0;
  await click('[data-act="sayLine"][data-k="0"]', 60);
  assert.equal(spoken.length, 1, "zapasowy głos z telefonu przeczytał zdanie");
  assert.match(document.querySelector(".toast")?.textContent || "", /Czyta głos z telefonu/);
  globalThis.fetch = orig;
});

test("ekran Lektor: jeden wybór głosu dla wszystkich języków, z odsłuchem", async () => {
  await click('[data-act="quit"]'); await click('[data-act="tab"][data-k="home"]'); await click('[data-act="tab"][data-k="me"]');
  assert.match(text(), /Google · Aoede i Charon/, "w O mnie tylko jedna linijka z lektorem");
  assert.ok(!document.querySelector("select[data-voice]"), "w O mnie nie ma już list głosów");
  await click('[data-act="openVoice"]');
  assert.match(text(), /Jedno ustawienie dla wszystkich języków/);
  const det = document.querySelector("details.devvoice");
  assert.ok(det && !det.open, "głosy z telefonu są zwinięte");
  ttsBodies.length = 0;
  await click('[data-act="pickVoice"][data-k="m:Puck"]', 60);
  assert.deepEqual([ttsBodies[0].gender, ttsBodies[0].voice, ttsBodies[0].lang], ["m", "Puck", "de"], "wybór od razu gra próbkę");
  assert.ok(document.querySelector('.vchip.sel[data-k="m:Puck"]'), "wybrany głos jest zaznaczony");
  w.dispatchEvent(new w.PopStateEvent("popstate")); await sleep(10);
  assert.match(text(), /O mnie/, "gest wstecz wraca do O mnie");
});

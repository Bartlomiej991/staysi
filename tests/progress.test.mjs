// Kalendarz, prognoza poziomu i filmy dodawane bez lekcji
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { boot, db, click, type, text, $ } from "./harness.mjs";

const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE"); };
before(async () => {
  db.profiles[0] = { ...db.profiles[0], name: "Bartek", onboarded: true, interests: ["Sport"], goal: "Praca" };
  db.user_languages.push({ id: 801, user_id: "u1", lang: "de", score: 47, lessons_done: 12, difficulty_shift: 0 });
  db.user_languages.push({ id: 802, user_id: "u1", lang: "es", score: 30, lessons_done: 2, difficulty_shift: 0 });
  for (let i = 1; i <= 6; i++) db.lessons.push({ id: 900 + i, user_id: "u1", lang: "de", minutes: 30, content: {}, completed_at: new Date(Date.now() - i * 864e5).toISOString(), score: 46 });
  db.activity.push({ id: 950, user_id: "u1", lang: "de", day: d(-1), kind: "video", minutes: 25, title: "Easy German" });
  await boot();
});

test("prognoza przy wyborze czasu: data dla każdego kafelka i zysk z filmu", async () => {
  await click('[data-act="openLang"][data-k="de"]');
  await click('[data-act="start"][data-k="de"]');
  const t = text();
  assert.match(t, /B2 ≈/, "pod kafelkami data następnego poziomu");
  assert.match(t, /Przy 15 min dziennie B2 ok\./);
  assert.match(t, /Dodaj 20 min filmu/, "dopisek, ile daje film na poziomie B");
  const f10 = $('[data-act="time"][data-k="10"] .fc').textContent, f45 = $('[data-act="time"][data-k="45"] .fc').textContent;
  assert.notEqual(f10, f45, "dłuższa nauka = wcześniejsza data");
  await click('.sheet [data-act="closeSheet"]');
});

test("film można dodać bez lekcji, na wczoraj, i usunąć", async () => {
  await click('[data-act="vidOpen"][data-k="de"]');
  await click('[data-act="vidSave"]'); assert.ok($(".sheet"), "bez minut nie zapisuje");
  await type("#vidMin", "35"); await click('[data-act="vidDay"][data-k="-1"]'); await click('[data-act="vidSave"]', 40);
  const row = db.activity.find(a => a.minutes === 35); assert.ok(row); assert.equal(row.day, d(-1), "film zapisany na wczoraj");
  await click('[data-act="vidOpen"][data-k="de"]'); await click('[data-act="vidMin"][data-k="10"]'); await click('[data-act="vidSave"]', 40);
  assert.match(text(), /Film\s*10 min/);
  await click('[data-act="vidOpen"][data-k="de"]'); await click('.sheet [data-act="vidDel"]', 40);
  assert.ok(!db.activity.some(a => a.minutes === 10 && a.day === d(0)), "usunięty");
  await click('.sheet [data-act="vidClose"]');
});

test("kalendarz: siatka dni, szczegóły dnia, podsumowania i osobno każdy język", async () => {
  await click('[data-act="tab"][data-k="home"]');
  await click('[data-act="tab"][data-k="cal"]');
  assert.match(text(), /Kalendarz/); assert.match(text(), /Podsumowanie/);
  assert.equal(document.querySelectorAll(".cal .cday").length, 42, "6 tygodni");
  await click(`[data-act="calDay"][data-k="${d(-1)}"]`);
  assert.match(text(), /Lekcje\s*1 · 30 min/); assert.match(text(), /Filmy\s*1 h/, "wczoraj: lekcja 30 min, filmy 25 + 35 min");
  assert.match(text(), /Easy German/);
  assert.match(text(), /7 dni z nauką|6 z 7 dni|z 7 dni z nauką/);
  await click('[data-act="calRange"][data-k="month"]'); assert.match(text(), /łącznie w ciągu: 30 dni/);
  await click('[data-act="calLang"][data-k="es"]'); assert.match(text(), /Hiszpański: teraz A2/);
  assert.match(text(), /0 min/, "hiszpański osobno, bez minut niemieckiego");
  await click('[data-act="calLang"][data-k="de"]'); assert.match(text(), /Niemiecki: teraz B1/);
});

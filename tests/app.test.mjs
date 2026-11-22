// Test całej aplikacji krok po kroku, tak jak klika użytkownik.
// Testy w tym pliku idą po kolei i dzielą stan (jak jedna sesja w aplikacji).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { boot, db, apiCalls, bodies, errors, spoken, click, type, text, sleep, $ } from "./harness.mjs";

let w;
const today = () => new Date().toLocaleDateString("sv-SE");
before(async () => { w = await boot(); });

test("pierwsze uruchomienie: kroki, cofanie i profil", async () => {
  assert.match(text(), /Zaczynamy/);
  await click('[data-act="obNext"]');
  assert.match(text(), /poligloto/);
  await click('[data-act="obBack"]');
  assert.match(text(), /Zaczynamy/, "Wstecz wraca do powitania");
  for (let i = 0; i < 4; i++) await click('[data-act="obNext"]');
  await type("#name", "Bartek"); await click('[data-act="obNext"]');
  await click('[data-act="obNext"]');
  await click('[data-act="interest"]'); await click('[data-act="obNext"]');
  await click('[data-act="goal"]'); await type("#ownGoal", "Egzamin"); await click('[data-act="addGoal"]');
  await click('[data-act="obNext"]', 50);
  assert.equal(db.profiles[0].name, "Bartek");
  assert.equal(db.profiles[0].name_vocative, "Bartku");
  assert.match(db.profiles[0].goal, /Egzamin/);
  assert.match(text(), /Których języków/);
});

test("test poziomu: cofanie, zero i krótki test", async () => {
  await click('[data-act="pick"][data-k="de"]'); await click('[data-act="pick"][data-k="en"]');
  await click('[data-act="obNext"]');
  assert.match(text(), /Jak oceniasz swój poziom/);
  await click('[data-act="plBack"]');
  assert.match(text(), /Których języków/, "Wstecz z testu wraca do wyboru języków");
  await click('[data-act="obNext"]');
  await click('[data-act="plSelf"][data-k="0"]'); await click('[data-act="plNext"]', 30);
  assert.match(text(), /A1/);
  await click('[data-act="plDone"]', 30);
  await click('[data-act="plSelf"][data-k="3"]'); await click('[data-act="plNext"]', 40);
  assert.match(text(), /TEST · 1/);
  await click('[data-act="plBack"]'); await click('[data-act="plNext"]', 40);
  assert.equal(apiCalls.filter(a => a === "placement_questions").length, 1, "po cofnięciu pytania nie są pobierane drugi raz");
  await click('[data-act="plAns"][data-k="0"]'); await click('[data-act="plNext"]');
  await type("#plWrite", "I like coding"); await click('[data-act="plNext"]', 50);
  assert.match(text(), /B1/);
  await click('[data-act="plDone"]', 80);
  assert.deepEqual(db.user_languages.map(l => [l.lang, l.score]).sort(), [["de", 22], ["en", 50]]);
  await click('[data-act="obNext"]', 60);
  assert.equal(db.profiles[0].onboarded, true);
  assert.ok($(".sheet"), "po planie otwiera się wybór czasu");
  await click('[data-act="closeSheet"]');
  assert.ok(!$(".sheet"), "Anuluj zamyka wybór czasu");
});

test("ekran języka ma cztery części", async () => {
  await click('[data-act="openLang"][data-k="de"]');
  const t = text();
  for (const part of ["Dzisiejsza lekcja", "Powtórka słówek", "Dodaj słówka", "Moja gramatyka", "Jak się uczyć?"]) assert.ok(t.includes(part), part);
});

test("pierwsza lekcja: bez powtórki, gramatyka, barometr, mówienie", async () => {
  await click('[data-act="start"][data-k="de"]');
  assert.ok($('.src.sel[data-k="auto"]'), "domyślnie tekst wymyśla Claude");
  await click('[data-act="srcPick"][data-k="topic"]');
  assert.notEqual($('.srcfield[data-src="topic"]').style.display, "none", "pole tematu się pokazuje");
  await click('[data-act="time"][data-k="15"]');
  assert.ok($(".sheet"), "bez wpisanego tematu lekcja nie startuje");
  await type("#srcTopic", "rozmowa o pracę");
  await click('[data-act="time"][data-k="15"]', 80);
  assert.equal(bodies.filter(b => b.action === "lesson").at(-1).topic, "rozmowa o pracę", "temat trafia do Claude'a");
  assert.match(text(), /KROK 1 · TŁUMACZENIE/, "pierwsza lekcja zaczyna się od nowego materiału");
  assert.match(text(), /dosłownie: Ja chciałbym chętnie jedną kawę\./, "na poziomie A widać tłumaczenie dosłowne");
  await click('[data-act="matNext"]');
  await click('[data-act="chunk"]', 40);
  assert.match(text(), /möchtest = forma od mögen/, "stuknięty zwrot pokazuje, jak jest zbudowany");
  assert.equal(db.bank.length, 1);
  await click('[data-act="matNext"]'); await click('[data-act="matNext"]');
  assert.match(text(), /JAK TO JEST ZBUDOWANE/); assert.match(text(), /Czasownik na 2\. miejscu/);
  assert.match(text(), /My mówimy tak, a po niemiecku/); assert.match(text(), /Dlaczego\? Niemcy grzecznie zamawiają/, "porównanie PL i DE z wyjaśnieniem");
  await sleep(20);
  assert.equal(db.grammar.length, 1, "wzór zapisany w Mojej gramatyce");
  await click('[data-act="matBack"]'); assert.match(text(), /SŁUCHANIE/);
  spoken.length = 0; await click('[data-act="playAll"]', 60);
  assert.deepEqual(spoken.map(x => x.voice), ["Anna (Enhanced)", "Yannick (Enhanced)"], "kobietę czyta głos kobiecy, mężczyznę męski");
  await click('[data-act="matNext"]'); await click('[data-act="matNext"]');
  assert.equal(db.grammar.length, 1, "powrót nie dubluje gramatyki");
  assert.match(text(), /JAK POSZŁO/);
  await click('[data-act="baro"][data-k="1"]');
  await click('[data-act="actBack"]'); await click('[data-act="baro"][data-k="1"]');
  assert.equal(db.user_languages.find(l => l.lang === "de").difficulty_shift, 1, "ponowny wybór barometru się nie sumuje");
  await type("#act", "Am Wochenende ich möchte gern spielen"); await click('[data-act="actSend"]', 80);
  assert.match(text(), /Am Wochenende möchte ich gern spielen/);
  await click('[data-act="finish"]', 80);
  assert.match(text(), /Brawo/);
  await type("#nextNote", "kwestie się nie łączyły");
  await click('[data-act="saveNote"]');
  assert.match(db.profiles[0].style_notes, /• kwestie się nie łączyły/, "uwaga po lekcji trafia do uwag dla Claude'a");
  assert.match(text(), /Zapisane\. Claude weźmie to pod uwagę/);
  await click('[data-act="lessonDone"]');
  assert.match(text(), /Dzisiejsza lekcja/, "po lekcji wracamy do ekranu języka");
  assert.match(text(), /Mapa Twoich tematów pojawi się po 3 lekcjach\. Teraz: 1 z 3/, "lekcja liczy się do mapy tematów");
});

test("druga lekcja zaczyna się od powtórki, a ✕ wraca do języka", async () => {
  await click('[data-act="start"][data-k="de"]'); await click('[data-act="time"][data-k="10"]', 80);
  assert.match(text(), /POWTÓRKA/);
  await click('[data-act="quit"]');
  assert.match(text(), /Dzisiejsza lekcja/);
});

test("bank słówek: dodawanie, lekcja, powtórka, lista", async () => {
  await type("#newWords", "der Hund - pies\nschnell\nlangsam\ndas Wochenende");
  await click('[data-act="wAdd"]', 80);
  const fresh = db.bank.filter(b => b.introduced === false);
  assert.equal(fresh.length, 4); assert.ok(fresh.every(b => b.ex && b.pron), "karty uzupełnione przez Claude");
  await click('[data-act="wLesson"]', 60);
  await click('[data-act="wIntroNext"]'); await click('[data-act="wIntroBack"]');
  assert.match(text(), /Nowe słówko 1 z/, "cofanie między kartami");
  while ($('[data-act="wIntroNext"]')) await click('[data-act="wIntroNext"]', 5);
  for (let i = 0; i < 120 && !/Lekcja ukończona/.test(text()); i++) {
    if ($('[data-act="wNext"]')) { await click('[data-act="wNext"]', 5); continue; }
    if ($('[data-act="wPick"]')) { await click([...document.querySelectorAll('[data-act="wPick"]')].at(i % 4), 5); continue; }
    if ($("#wAns")) { const hit = db.bank.find(b => b.meaning === $(".wcard .wpl").textContent); await type("#wAns", hit ? hit.chunk : "x"); await click('[data-act="wCheck"]', 5); continue; }
    if ($('[data-act="wTile"]')) { await click('[data-act="wTile"]', 5); await click('[data-act="wTilesCheck"]', 5); continue; }
    if ($('[data-act="wReveal"]')) { await click('[data-act="wReveal"]', 5); await click('[data-act="wSelf"]', 5); continue; }
  }
  assert.match(text(), /Lekcja ukończona/);
  assert.ok(fresh.every(b => b.introduced === true && b.strength === 1), "po lekcji słówka są poznane, siła 1");
  await click('[data-act="wBack"]');
  fresh.forEach(b => (b.due = today()));
  await click('[data-act="tab"][data-k="home"]');
  assert.match(text(), /czeka na powtórkę/);
  await click('[data-act="openLang"][data-k="de"]'); await click('[data-act="wReview"]', 40);
  for (let i = 0; i < 60 && !/Powtórka zrobiona/.test(text()); i++) {
    if ($('[data-act="wNext"]')) { await click('[data-act="wNext"]', 5); continue; }
    if ($("#wAns")) { const hit = db.bank.find(b => b.meaning === $(".wcard .wpl").textContent); await type("#wAns", hit ? hit.chunk : "x"); await click('[data-act="wCheck"]', 5); continue; }
    if ($('[data-act="wTilesCheck"]')) { await click('[data-act="wTile"]', 5); await click('[data-act="wTilesCheck"]', 5); continue; }
    if ($('[data-act="wReveal"]')) { await click('[data-act="wReveal"]', 5); await click('[data-act="wSelf"][data-k="1"]', 5); continue; }
  }
  assert.match(text(), /Powtórka zrobiona/);
  assert.ok(fresh.some(b => b.strength === 2 && b.due > today()), "dobra odpowiedź wydłuża przerwę");
  await click('[data-act="wBack"]'); await click('[data-act="wList"]');
  assert.match(text(), /Wszystkie słówka/); assert.match(text(), /der Hund/);
  await click('[data-act="wBack"]');
});

test("Moja gramatyka i przewodnik", async () => {
  await click('[data-act="openGrammar"]');
  assert.match(text(), /Moja gramatyka/); assert.match(text(), /Kolejność słów/);
  await click('[data-act="gToggle"]'); assert.match(text(), /Heute spiele ich/);
  await click('[data-act="toLang"]'); await click('[data-act="openGuide"]');
  assert.match(text(), /Codzienny rytm/); assert.match(text(), /tryb A/);
});

test("systemowy gest wstecz cofa o jeden ekran", async () => {
  w.dispatchEvent(new w.PopStateEvent("popstate")); await sleep(10);
  assert.match(text(), /Dzisiejsza lekcja/, "z przewodnika do języka");
  w.dispatchEvent(new w.PopStateEvent("popstate")); await sleep(10);
  assert.match(text(), /Cześć,/, "z języka na start");
});

test("koszty, ustawienia i brak ukrytych błędów", async () => {
  for (const tab of ["bank", "cost", "me", "home"]) await click(`[data-act="tab"][data-k="${tab}"]`);
  await click('[data-act="addLang"]'); await click('[data-act="closeAdd"]');
  assert.ok(!$(".overlay"));
  assert.deepEqual(errors, [], "żadnych nieobsłużonych błędów");
});

// Zakładka Koszty jest tylko dla właściciela aplikacji (OWNER_EMAIL albo pierwszy adres z ALLOWED_EMAILS).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { boot, db, click, text, $ } from "./harness.mjs";
import { ownerHash } from "../api/config.js";

const h = e => createHash("sha256").update(e).digest("hex");

test("serwer wysyła tylko skrót adresu właściciela", () => {
  assert.equal(ownerHash({ OWNER_EMAIL: " Bartek@Example.com " }), h("bartek@example.com"));
  assert.equal(ownerHash({ ALLOWED_EMAILS: "a@x.pl, b@x.pl" }), h("a@x.pl"), "bez OWNER_EMAIL: pierwszy dozwolony adres");
  assert.equal(ownerHash({}), "", "bez ustawień nic nie ukrywamy");
});

before(async () => {
  globalThis.__ownerHash = h("wlasciciel@staysi"); globalThis.__email = "gosc@staysi";
  db.profiles[0] = { ...db.profiles[0], name: "Gość", onboarded: true, interests: ["Sport"], goal: "Praca" };
  db.user_languages.push({ id: 901, user_id: "u1", lang: "de", score: 22, lessons_done: 0, difficulty_shift: 0 });
  await boot();
});

test("inne konto nie widzi zakładki Koszty i nie wejdzie do niej", async () => {
  assert.ok($('[data-act="tab"][data-k="me"]'), "nawigacja jest");
  assert.ok(!$('[data-act="tab"][data-k="cost"]'), "brak zakładki Koszty");
  // podrobiony przycisk (np. ktoś dopisze go w konsoli) też nie otwiera Kosztów
  const fake = document.createElement("button"); fake.dataset.act = "tab"; fake.dataset.k = "cost";
  document.querySelector(".app").appendChild(fake); await click(fake);
  assert.doesNotMatch(text(), /Na co idą pieniądze/);
});

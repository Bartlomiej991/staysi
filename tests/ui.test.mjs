// Test wyglądu w prawdziwej przeglądarce Chrome, w rozmiarze iPhone'a (390 × 844).
// Przeklikuje aplikację i na każdym ekranie sprawdza, czy żaden przycisk ani pole nie wychodzi poza ekran.
// Zrzuty ekranów zapisuje w tests/screens/ (folder nie trafia na GitHuba).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fakeAnswer } from "./fake-api.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tests", "screens");
const CHROME = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch {}
const skip = !CHROME || !chromium ? "brak Chrome albo playwright-core na tym komputerze" : false;

let server, browser, page, base, shot = 0;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

before(async () => {
  if (skip) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) fs.unlinkSync(path.join(SHOTS, f));
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/config") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ supabaseUrl: "x", supabaseAnonKey: "y" })); }
    if (url.pathname === "/api/ai") {
      let body = ""; req.on("data", c => (body += c)); req.on("end", () => { const b = JSON.parse(body); res.setHeader("content-type", "application/json"); res.end(JSON.stringify(fakeAnswer(b.action, b))); });
      return;
    }
    const file = url.pathname === "/fake-supabase.js" ? path.join(ROOT, "tests", "fake-supabase.js") : path.join(ROOT, "public", url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  // Supabase z internetu podmieniamy na atrapę, czcionki z Google'a pomijamy (test działa bez internetu)
  const fake = fs.readFileSync(path.join(ROOT, "tests", "fake-supabase.js"), "utf8");
  await page.route("https://esm.sh/**", r => r.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: fake }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base);
  try { await page.waitForSelector('[data-act="obNext"]', { timeout: 15000 }); }
  catch (e) { throw new Error(`Aplikacja się nie uruchomiła: ${errors.join(" | ")} | ekran: ${(await page.textContent("body")).slice(0, 200)}`); }
});
after(async () => { await browser?.close(); server?.close(); });

const errors = [];
const click = async (sel, wait = 120) => { await page.locator(sel).first().click(); await page.waitForTimeout(wait); };
const fill = (sel, v) => page.locator(sel).first().fill(v);

// Na każdym ekranie: nic klikalnego nie może wystawać poza ekran ani być zasłonięte przez krawędź
async function check(name) {
  shot++;
  await page.screenshot({ path: path.join(SHOTS, `${String(shot).padStart(2, "0")}-${name}.png`), fullPage: true });
  const bad = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, out = [];
    for (const el of document.querySelectorAll("button, a, input, textarea, select, label.f, .bubble, .card, .wcard, .gcard")) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || cs.display === "none" || cs.visibility === "hidden") continue;
      if (r.right > W + 2 || r.left < -2) out.push(`${el.tagName.toLowerCase()}${el.dataset.act ? `[${el.dataset.act}]` : ""} „${(el.textContent || el.placeholder || "").trim().slice(0, 30)}” (${Math.round(r.left)}–${Math.round(r.right)} px przy ekranie ${W} px)`);
    }
    // tekst ma stać prosto: żaden kafelek z treścią nie może być przechylony
    for (const el of document.querySelectorAll(".bubble, .sticker, .time, .tip, .gapcard, .streak, .stamp, .card, .gcard, .wcard, .msg .b")) {
      const t = getComputedStyle(el).transform;
      if (t && t !== "none") { const [a, b] = t.replace(/^matrix\(|\)$/g, "").split(",").map(Number); if (Math.abs(b) > 0.001 || Math.abs(a - 1) > 0.001) out.push(`przechylony kafelek „${el.textContent.trim().slice(0, 30)}”`); }
    }
    if (document.documentElement.scrollWidth > W + 2) out.push(`cała strona przewija się w bok (${document.documentElement.scrollWidth} px)`);
    return out;
  });
  assert.deepEqual(bad, [], `Ekran „${name}”: elementy poza ekranem`);
}

test("wygląd: pierwsze uruchomienie i test poziomu", { skip }, async () => {
  await check("powitanie");
  await click('[data-act="obNext"]'); await check("cytat");
  for (let i = 0; i < 3; i++) await click('[data-act="obNext"]');
  await check("imie"); await fill("#name", "Bartek"); await click('[data-act="obNext"]', 300);
  await check("o-mnie"); await click('[data-act="obNext"]');
  await check("zainteresowania"); await click('[data-act="interest"]'); await click('[data-act="obNext"]');
  await check("cele"); await click('[data-act="goal"]'); await click('[data-act="obNext"]', 300);
  await check("jezyki"); await click('[data-act="pick"][data-k="de"]'); await click('[data-act="obNext"]');
  await check("samoocena"); await click('[data-act="plSelf"][data-k="2"]'); await click('[data-act="plNext"]', 300);
  await check("pytanie-testu"); await click('[data-act="plAns"][data-k="0"]'); await click('[data-act="plNext"]');
  await check("pisanie"); await fill("#plWrite", "Ich heiße Bartek."); await click('[data-act="plNext"]', 300);
  await check("wynik-testu"); await click('[data-act="plDone"]', 400);
  await check("plan"); await click('[data-act="obNext"]', 300);
});

test("wygląd: start, ekran języka, wybór lekcji", { skip }, async () => {
  await check("wybor-czasu"); await click('[data-act="srcPick"][data-k="topic"]'); await check("wybor-czasu-temat");
  await click('button[data-act="closeSheet"]'); await check("start");
  await click('[data-act="openLang"][data-k="de"]', 200); await check("ekran-jezyka");
});

test("wygląd: lekcja od początku do końca", { skip }, async () => {
  await click('[data-act="start"][data-k="de"]'); await click('[data-act="time"][data-k="15"]', 500);
  await check("lekcja-tlumaczenie"); await click('[data-act="matNext"]');
  await click('[data-act="chunk"]', 200); await check("lekcja-oryginal-zwrot");
  await click('[data-act="matNext"]'); await check("lekcja-sluchanie");
  await click('[data-act="matNext"]', 200); await check("lekcja-gramatyka");
  await click('[data-act="matNext"]'); await check("lekcja-barometr");
  await click('[data-act="baro"][data-k="0"]', 200); await check("lekcja-mowienie");
  await fill("#act", "Am Wochenende möchte ich gern schwimmen."); await click('[data-act="actSend"]', 400); await check("lekcja-poprawka");
  await click('[data-act="finish"]', 500); await check("lekcja-koniec");
  await click('[data-act="lessonDone"]', 200);
});

test("wygląd: bank słówek, gramatyka, przewodnik, zakładki", { skip }, async () => {
  await fill("#newWords", "das Wochenende\nder Hund - pies\nschnell\nlangsam"); await click('[data-act="wAdd"]', 500);
  await check("slowka-dodane");
  await click('[data-act="wLesson"]', 400); await check("slowka-karta");
  await click('[data-act="wIntroNext"]'); await check("slowka-karta-2");
  for (let i = 0; i < 10 && await page.locator('[data-act="wIntroNext"]').count(); i++) await click('[data-act="wIntroNext"]', 60);
  await check("slowka-cwiczenie");
  await click('[data-act="wQuit"]', 200);
  await click('[data-act="wList"]'); await check("slowka-lista"); await click('[data-act="wBack"]');
  await click('[data-act="openGrammar"]'); await click('[data-act="gToggle"]'); await check("moja-gramatyka");
  await click('[data-act="toLang"]'); await click('[data-act="openGuide"]'); await check("przewodnik");
  await click('[data-act="toLang"]'); await click('[data-act="tab"][data-k="home"]');
  for (const t of ["bank", "cost", "me"]) { await click(`[data-act="tab"][data-k="${t}"]`, 200); await check(`zakladka-${t}`); }
  assert.deepEqual(errors, [], "błędy JavaScript na stronie");
});

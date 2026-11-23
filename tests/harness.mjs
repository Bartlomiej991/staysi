// Środowisko testowe: przeglądarka (jsdom), udawany Supabase i udawany serwer /api.
// Nic nie łączy się z prawdziwym Supabase ani z Claude, więc testy są darmowe i nie potrzebują kluczy.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");

export const db = { profiles: [{ id: "u1", name: "", name_vocative: "", native: "pl", job: "", city: "", about: "", interests: [], goal: "", budget_usd: 5, remind: true, remind_at: "19:00", onboarded: false }],
  user_languages: [], bank: [], lessons: [], usage: [], grammar: [], mistakes: [], activity: [] };
export const apiCalls = [];
export const bodies = [];
export const ttsBodies = [];
let nextId = 1;

function table(name) {
  const rows = db[name];
  const st = { filters: [], op: "select", payload: null, one: false,
    select() { return st; }, eq(k, v) { st.filters.push(r => r[k] === v); return st; }, gte() { return st; }, not(k) { st.filters.push(r => r[k] != null); return st; }, is(k, v) { st.filters.push(r => (r[k] ?? null) === v); return st; }, in(k, v) { st.filters.push(r => v.includes(r[k])); return st; }, lte() { return st; }, delete() { st.op = "delete"; return st; }, order() { return st; }, limit() { return st; },
    single() { st.one = true; return st; },
    update(p) { st.op = "update"; st.payload = p; return st; }, upsert(p) { st.op = "upsert"; st.payload = p; return st; }, insert(p) { st.op = "insert"; st.payload = p; return st; },
    then(res, rej) {
      let out;
      if (st.op === "delete") { for (let i = rows.length - 1; i >= 0; i--) if (st.filters.every(f => f(rows[i]))) rows.splice(i, 1); out = { data: null, error: null }; }
      else if (st.op === "update") { rows.filter(r => st.filters.every(f => f(r))).forEach(r => Object.assign(r, st.payload)); out = { data: null, error: null }; }
      else if (st.op === "upsert" || st.op === "insert") { const p = { id: nextId++, ...st.payload }; rows.push(p); out = { data: st.one ? p : [p], error: null }; }
      else { const d = rows.filter(r => st.filters.every(f => f(r))); out = { data: st.one ? d[0] : d, error: null }; }
      return Promise.resolve(out).then(res, rej);
    } };
  return st;
}
const sbStub = { from: table, auth: { getSession: async () => ({ data: { session: { user: { id: "u1", email: globalThis.__email || "test@staysi" }, access_token: "t" } } }), onAuthStateChange() {}, signOut: async () => {} } };

import { LESSON, fakeAnswer } from "./fake-api.mjs";
export { LESSON };

async function fakeApi(url, opt = {}) {
  if (url === "/api/config") return { ok: true, json: async () => ({ supabaseUrl: "x", supabaseAnonKey: "y", cloudVoice: !!globalThis.__cloud, ownerHash: globalThis.__ownerHash || "" }) };
  if (url === "/api/tts") { ttsBodies.push(JSON.parse(opt.body)); return { ok: true, blob: async () => new Blob(["mp3"]), json: async () => ({}) }; }
  if (url === "/api/backup") { const b = JSON.parse(opt.body); backupCalls.push(b); const out = (globalThis.__backup || (() => ({})))(b); return { ok: !out.error, json: async () => out }; }
  const body = JSON.parse(opt.body), a = body.action; apiCalls.push(a); bodies.push(body);
  const out = fakeAnswer(a, body);
  db.usage.push({ cost_usd: 0.001, purpose: a, model: "claude-haiku", lang: body.lang || null, input_tokens: 100, output_tokens: 10, created_at: new Date().toISOString() });
  return { ok: true, json: async () => out };
}

export const errors = [];
export const backupCalls = [];
export const spoken = [];
export async function boot() {
  const html = fs.readFileSync(path.join(PUB, "index.html"), "utf8").replace(/<script type="module"[^>]*><\/script>/, "");
  const dom = new JSDOM(html, { url: "https://staysi.test/", pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, localStorage: w.localStorage, location: w.location, history: w.history, Image: w.Image, Audio: w.Audio, Blob: w.Blob, __sb: sbStub, fetch: fakeApi });
  const V = (name, lang) => ({ name, lang, voiceURI: name, localService: true });
  const voices = [V("Anna (Enhanced)", "de-DE"), V("Helena", "de-DE"), V("Yannick (Enhanced)", "de-DE"), V("Samantha", "en-US"), V("Daniel", "en-GB")];
  w.speechSynthesis = { getVoices: () => voices, speak(u) { spoken.push({ text: u.text, voice: u.voice?.name }); if (u.onend) setTimeout(u.onend, 0); }, cancel() {}, addEventListener() {} }; globalThis.speechSynthesis = w.speechSynthesis;
  w.SpeechSynthesisUtterance = function (t) { this.text = t; }; globalThis.SpeechSynthesisUtterance = w.SpeechSynthesisUtterance;
  process.on("unhandledRejection", e => errors.push(e));
  // app.js ładuje Supabase z internetu; w teście podmieniamy go na atrapę
  const src = fs.readFileSync(path.join(PUB, "app.js"), "utf8")
    .replace(/^import \{ createClient \}.*$/m, "const createClient = () => globalThis.__sb;")
    .replace('"./words.js"', JSON.stringify(pathToFileURL(path.join(PUB, "words.js")).href))
    .replace('"./learn.js"', JSON.stringify(pathToFileURL(path.join(PUB, "learn.js")).href))
    .replace('"./scenes.js"', JSON.stringify(pathToFileURL(path.join(PUB, "scenes.js")).href))
    .replace('"./progress.js"', JSON.stringify(pathToFileURL(path.join(PUB, "progress.js")).href));
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "staysi-")), "app.mjs");
  fs.writeFileSync(tmp, src);
  await import(pathToFileURL(tmp).href);
  await sleep(50);
  return w;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const $ = s => document.querySelector(s);
export const text = () => document.querySelector("#app").textContent.replace(/\s+/g, " ");
export async function click(sel, wait = 15) {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (!el) throw new Error(`Brak elementu ${sel}. Ekran: ${text().slice(0, 150)}`);
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(wait);
}
export async function type(sel, value) { const el = $(sel); if (!el) throw new Error(`Brak pola ${sel}`); el.value = value; }

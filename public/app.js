// STAYSI: aplikacja (przeglądarka). Dane w Supabase (RLS), Claude przez nasz serwer /api/ai.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/* ================= Dane stałe ================= */
const LANGS = {
  pl: { name: "Polski", hi: "Cześć!", code: "pl-PL" },
  de: { name: "Niemiecki", hi: "Hallo!", code: "de-DE" },
  es: { name: "Hiszpański", hi: "¡Hola!", code: "es-ES" },
  fr: { name: "Francuski", hi: "Bonjour!", code: "fr-FR" },
  en: { name: "Angielski", hi: "Hello!", code: "en-GB" },
  it: { name: "Włoski", hi: "Ciao!", code: "it-IT" }
};
const BANDS = [["A1",22,29],["A2",30,35],["A2+",36,42],["B1",43,50],["B1+",51,58],["B2",59,66],["B2+",67,75],["C1",76,84],["C2",85,90]];
const SELF = [
  { l: "Zaczynam od zera", s: 22 }, { l: "Znam podstawy", s: 28 }, { l: "Dogaduję się", s: 44 },
  { l: "Mówię swobodnie", s: 61 }, { l: "Prawie jak native", s: 78 }
];
const INTERESTS = ["Sport", "Muzyka", "Gotowanie", "Technologia", "Podróże", "Filmy i seriale", "Książki", "Gry", "Natura", "Biznes"];
const GOALS = ["Praca", "Podróże", "Przeprowadzka", "Rodzina i znajomi", "Dla siebie"];
const QUOTES = [
  { t: "Granice mojego języka oznaczają granice mojego świata.", a: "Ludwig Wittgenstein" },
  { t: "Kto nie zna języków obcych, nie wie nic o własnym.", a: "Johann Wolfgang von Goethe" },
  { t: "Ciężko jest dać nieograniczoną energię ograniczonym umysłom.", a: "motto STAYSI" }
];
const TILE = [
  { bg: "#FFC53D", fg: "#1E1B3A" }, { bg: "#FFFFFF", fg: "#1E1B3A" }, { bg: "#2BB673", fg: "#0B3D25" },
  { bg: "#8FB8FF", fg: "#10265E" }, { bg: "#FF8E6E", fg: "#4A1405" }
];
const TIMES = [
  { m: 10, l: "Szybka dawka", bg: "#2BB673", fg: "#0B3D25", n: 4 },
  { m: 15, l: "Standard", bg: "#FFC53D", fg: "#1E1B3A", n: 6 },
  { m: 30, l: "Solidna sesja", bg: "#8FB8FF", fg: "#10265E", n: 10 },
  { m: 45, l: "Pełny trening", bg: "#FF8E6E", fg: "#4A1405", n: 12 }
];
const INTERVAL = [1, 1, 3, 7, 14, 30]; // dni do następnej powtórki według siły zwrotu
const PURPOSE = { lesson: "Lekcja", review: "Karty powtórki", check: "Sprawdzenie odpowiedzi", feedback: "Poprawki", placement: "Test poziomu", plan: "Plan nauki", vocative: "Forma imienia", photo: "Zdjęcie strony" };

/* ================= Ikony ================= */
const I = {
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8.5a5 5 0 0 1 0 7"/></svg>',
  mic: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC53D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  flame: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" fill="#FF6B4A"/></svg>',
  check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1E1B3A" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M16 15h2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
};

/* ================= Stan ================= */
let sb = null;
const S = {
  session: null, profile: null, langs: {}, bank: [], usage: [], doneDays: {}, view: "loading",
  auth: { mode: "login", msg: "" }, ob: { step: 0, sel: [], self: {}, idx: 0 }, pl: null,
  sheet: null, L: null, busy: null, add: null, voice: loadLocal("staysiVoices", {}), rate: loadLocal("staysiRate", 0.95)
};

/* ================= Pomocnicze ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const band = s => BANDS.find(b => s <= b[2]) || BANDS[BANDS.length - 1];
const pct = s => { const b = band(s); return Math.max(0, Math.min(100, Math.round((s - b[1]) / (b[2] - b[1] + 1) * 100))); };
const nextBand = s => BANDS[Math.min(BANDS.indexOf(band(s)) + 1, BANDS.length - 1)][0];
const modeOf = s => (s < 43 ? "A" : s < 76 ? "B" : "C");
const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("sv-SE"); };
const quote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];
const usd = v => (v < 0.01 ? "$" + v.toFixed(4) : "$" + v.toFixed(2));
const uid = () => S.session?.user?.id;
const greetName = () => S.profile?.name_vocative || S.profile?.name || "poligloto";
function loadLocal(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function saveLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function toast(t, ms = 4500) { document.querySelectorAll(".toast").forEach(x => x.remove()); const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "alert"); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), ms); }
function norm(s) { return String(s).toLowerCase().replace(/ß/g, "ss").replace(/[.,!?;:„”"'¡¿«»]/g, "").replace(/\s+/g, " ").trim(); }
function lev(a, b) { const m = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i; for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return m[b.length]; }

async function ai(action, payload) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
  const out = await r.json().catch(() => ({ error: "Brak odpowiedzi serwera." }));
  if (!r.ok) throw new Error(out.error || "Coś poszło nie tak.");
  return out;
}
async function withBusy(msg, fn) {
  S.busy = msg; render();
  try { return await fn(); }
  catch (e) { toast(e.message || "Coś poszło nie tak."); return null; }
  finally { S.busy = null; render(); }
}

/* ================= Lektor ================= */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley/i;
let VOICES = [];
function loadVoices() { try { VOICES = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch { VOICES = []; } }
loadVoices(); try { speechSynthesis.addEventListener("voiceschanged", () => { loadVoices(); if (S.view === "me") render(); }); } catch {}
const quality = v => { const s = (v.name + " " + v.voiceURI).toLowerCase(); return /premium/.test(s) ? 3 : /enhanced|ulepsz|rozszerz|neural|natural|siri/.test(s) ? 2 : 1; };
function voicesFor(lang) {
  const code = (LANGS[lang]?.code || lang).toLowerCase(), base = code.slice(0, 2);
  return VOICES.filter(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(base) && !NOVELTY.test(v.name))
    .map(v => ({ v, s: quality(v) * 10 + (v.lang.toLowerCase().replace("_", "-") === code ? 2 : 0) + (v.localService ? 1 : 0) }))
    .sort((a, b) => b.s - a.s).map(x => x.v);
}
const voiceFor = lang => { const l = voicesFor(lang); return l.find(v => v.voiceURI === S.voice[lang]) || l[0] || null; };
function speak(text, lang, onend) {
  try {
    if (!("speechSynthesis" in window)) { toast("Ta przeglądarka nie ma lektora."); onend && onend(); return; }
    if (!VOICES.length) loadVoices();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = LANGS[lang]?.code || lang; u.rate = S.rate || 0.95;
    const v = voiceFor(lang); if (v) { u.voice = v; u.lang = v.lang; }
    if (onend) u.onend = onend;
    speechSynthesis.speak(u);
  } catch { onend && onend(); }
}
const stopSpeech = () => { try { speechSynthesis.cancel(); } catch {} };

/* ================= Dyktowanie ================= */
let rec = null;
function dictate(targetId, lang, btn) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { toast("Użyj mikrofonu na klawiaturze telefonu, żeby podyktować odpowiedź."); $("#" + targetId)?.focus(); return; }
  if (rec) { rec.stop(); return; }
  rec = new R(); rec.lang = LANGS[lang]?.code || lang; rec.interimResults = false; rec.continuous = false;
  const el = $("#" + targetId); btn.classList.add("on");
  rec.onresult = e => { const t = Array.from(e.results).map(r => r[0].transcript).join(" "); el.value = (el.value ? el.value + " " : "") + t; };
  rec.onerror = () => toast("Nie udało się rozpoznać mowy. Spróbuj jeszcze raz.");
  rec.onend = () => { btn.classList.remove("on"); rec = null; };
  rec.start();
}

/* ================= Dane z bazy ================= */
async function loadAll() {
  const id = uid();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const since = new Date(); since.setDate(since.getDate() - 120);
  const [p, l, b, u, ls] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).single(),
    sb.from("user_languages").select("*"),
    sb.from("bank").select("*").order("created_at", { ascending: false }),
    sb.from("usage").select("*").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }),
    sb.from("lessons").select("lang,completed_at").not("completed_at", "is", null).gte("completed_at", since.toISOString())
  ]);
  S.profile = p.data || { id, name: "", onboarded: false, interests: [] };
  S.langs = {}; (l.data || []).forEach(r => (S.langs[r.lang] = r));
  S.bank = b.data || []; S.usage = u.data || [];
  S.doneDays = {}; (ls.data || []).forEach(r => { const d = new Date(r.completed_at).toLocaleDateString("sv-SE"); (S.doneDays[d] = S.doneDays[d] || new Set()).add(r.lang); });
}
async function reloadUsage() {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data } = await sb.from("usage").select("*").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false });
  S.usage = data || [];
}
function streak() {
  let n = 0, i = S.doneDays[day(0)] ? 0 : -1;
  while (S.doneDays[day(i)]) { n++; i--; }
  return n;
}
async function saveProfile(fields) {
  Object.assign(S.profile, fields);
  const { error } = await sb.from("profiles").update(fields).eq("id", uid());
  if (error) toast("Nie udało się zapisać profilu.");
}
async function addToBank(lang, chunk, meaning, context) {
  if (S.bank.find(b => b.lang === lang && b.chunk === chunk)) return false;
  const row = { user_id: uid(), lang, chunk, meaning: meaning || "", context: context || "", strength: 0, due: day(1) };
  const { data, error } = await sb.from("bank").upsert(row, { onConflict: "user_id,lang,chunk", ignoreDuplicates: true }).select().single();
  S.bank.unshift(data || row);
  return !error;
}

/* ================= Render ================= */
function render() {
  const app = $("#app"); let html = "";
  if (S.view === "loading") html = `<div class="screen center-screen bg-indigo"><div class="logo big">STAYSI</div></div>`;
  else if (S.view === "setup") html = renderSetup();
  else if (S.view === "auth") html = renderAuth();
  else if (S.view === "ob") html = renderOb();
  else if (S.view === "placement") html = renderPlacement();
  else if (S.view === "lesson") html = renderLesson();
  else html = renderMain();
  if (S.sheet) html += renderSheet();
  if (S.add) html += renderAdd();
  if (S.busy) html += `<div class="busy" role="status" aria-live="polite"><div class="spinner"></div><h2>${esc(S.busy)}</h2></div>`;
  app.innerHTML = html;
  afterRender();
}
const scrollTop = () => { const s = document.querySelector(".screen"); if (s) s.scrollTop = 0; };

function renderSetup() {
  return `<div class="screen bg-indigo"><h2>Brak konfiguracji</h2><p>Serwer nie zwrócił adresu Supabase. Sprawdź zmienne środowiskowe SUPABASE_URL i SUPABASE_ANON_KEY w Vercel.</p></div>`;
}

/* --- Logowanie --- */
function renderAuth() {
  const reg = S.auth.mode === "register";
  return `<div class="screen bg-indigo">
    <div class="blob" style="width:300px;height:300px;background:var(--indigo-2);top:-100px;right:-120px"></div>
    <div class="grow"></div>
    <div class="logo big" style="position:relative">STAYSI</div>
    <h2 style="position:relative">${reg ? "Załóż konto" : "Zaloguj się"}</h2>
    <form id="authForm" style="display:flex;flex-direction:column;gap:12px;position:relative">
      <label class="f">E-mail<input class="field" type="email" id="email" autocomplete="email" value="${esc(S.auth.email || "")}" required></label>
      <label class="f">Hasło<input class="field" type="password" id="pass" autocomplete="${reg ? "new-password" : "current-password"}" minlength="8" required></label>
      ${S.auth.msg ? `<p class="small" style="background:rgba(255,255,255,.12);padding:12px;border-radius:14px">${esc(S.auth.msg)}</p>` : ""}
      <button class="btn btn-sun" type="submit">${reg ? "Załóż konto" : "Zaloguj"}</button>
    </form>
    <button class="btn btn-ghost" data-act="authMode" style="position:relative">${reg ? "Mam już konto" : "Nie masz konta? Załóż je"}</button>
  </div>`;
}

/* --- Pierwsze uruchomienie --- */
const OB_LAST = 9;
function obShell(body, btn, cls = "bg-indigo", dots = true) {
  const st = S.ob.step;
  return `<div class="screen ${cls}">${body}</div>
  <div class="footer ${cls}">${dots ? `<div class="dots" style="margin-bottom:12px">${Array.from({ length: OB_LAST + 1 }, (_, i) => `<i class="${i <= st ? "on" : ""}"></i>`).join("")}</div>` : ""}
  <button class="btn btn-sun" data-act="obNext">${btn}</button></div>`;
}
function renderOb() {
  const st = S.ob.step, P = S.profile;
  if (st === 0) return obShell(`
    <div class="blob" style="width:320px;height:320px;background:var(--indigo-2);top:-90px;right:-120px"></div>
    <div class="blob" style="width:180px;height:180px;background:var(--sun);bottom:120px;left:-70px"></div>
    <div class="grow"></div>
    <div style="position:relative;display:flex;flex-direction:column;gap:18px">
      <div class="logo big">STAYSI</div><div class="greet" id="greet">Cześć!</div>
      <p class="soft">Ucz się języków na tym, co cię naprawdę interesuje.</p></div>`, "Zaczynamy", "bg-indigo", false);
  if (st === 1) { const q = quote(); return obShell(`<div class="grow"></div>
    <h1 style="font-size:56px;line-height:.98">Cześć,<br>poligloto!</h1>
    <p class="quote soft" style="max-width:300px">„${esc(q.t)}”<br><b style="color:#fff">${esc(q.a)}</b></p><div class="grow"></div>`, "Dalej"); }
  if (st === 2) return obShell(`<h2>Jak działa STAYSI</h2>
    <p class="soft">Aplikacja opiera się na metodzie Luki Lampariello. Każda lekcja łączy trzy filary:</p>
    <div class="bubble tilt-l" style="background:var(--sky);color:#10265E"><b>Powtórka.</b> Zwroty wracają w odpowiednim momencie, zanim je zapomnisz.</div>
    <div class="bubble right tilt-r" style="background:var(--mint);color:#0B3D25"><b>Nowy materiał.</b> Ciekawe, zrozumiałe treści o twoim życiu i pasjach.</div>
    <div class="bubble tilt-l" style="background:var(--coral-2);color:#4A1405"><b>Mówienie.</b> Od pierwszego dnia mówisz i piszesz, a Claude cię poprawia.</div>
    <p class="small soft-2">Więcej o metodzie znajdziesz w zakładce O mnie.</p>`, "Rozumiem");
  if (st === 3) return obShell(`<h2>Twój język ojczysty</h2><p class="soft">W nim dostaniesz tłumaczenia i wyjaśnienia.</p>
    <div class="opts">${Object.entries(LANGS).map(([k, v]) => `<button class="opt ${P.native === k ? "sel" : ""}" data-act="native" data-k="${k}">${v.name}</button>`).join("")}</div>`, "Dalej");
  if (st === 4) return obShell(`<h2>Jak masz na imię?</h2>
    <label class="f">Imię<input class="field" type="text" id="name" value="${esc(P.name)}" autocomplete="given-name" placeholder="np. Bartek"></label>`, "Dalej");
  if (st === 5) return obShell(`<h2>Opowiedz o sobie</h2><p class="soft">Kilka słów wystarczy. Każde pole możesz pominąć.</p>
    <label class="f">Czym się zajmujesz?<input class="field" type="text" id="job" value="${esc(P.job)}" placeholder="np. pracuję jako…"></label>
    <label class="f">Gdzie mieszkasz?<input class="field" type="text" id="city" value="${esc(P.city)}"></label>
    <label class="f">Coś jeszcze o tobie?<textarea class="field" id="about" placeholder="rodzina, plany, marzenia…">${esc(P.about)}</textarea></label>`, "Dalej");
  if (st === 6) return obShell(`<h2>Co lubisz?</h2><p class="soft">Z tego Claude będzie układał lekcje.</p>
    <div class="chips">${INTERESTS.map(i => `<button class="chip ${(P.interests || []).includes(i) ? "sel" : ""}" data-act="interest" data-k="${esc(i)}">${esc(i)}</button>`).join("")}
    ${(P.interests || []).filter(i => !INTERESTS.includes(i)).map(i => `<button class="chip sel" data-act="interest" data-k="${esc(i)}">${esc(i)}</button>`).join("")}</div>
    <div class="answer"><label class="f" style="flex:1">Coś własnego?<input class="field" type="text" id="ownInt" placeholder="np. astronomia"></label><button class="pillbtn" style="background:#fff;color:var(--indigo);height:52px" data-act="addInterest">Dodaj</button></div>`, "Dalej");
  if (st === 7) { const goals = goalList(); return obShell(`<h2>Po co się uczysz?</h2><p class="soft">Możesz wybrać kilka i dopisać własny cel.</p>
    <div class="chips">${[...new Set([...GOALS, ...goals])].map(g => `<button class="chip ${goals.includes(g) ? "sel" : ""}" data-act="goal" data-k="${esc(g)}">${esc(g)}</button>`).join("")}</div>
    <div class="answer"><label class="f" style="flex:1">Własny cel<input class="field" type="text" id="ownGoal" placeholder="np. egzamin, rozmowa o pracę"></label><button class="pillbtn" style="background:#fff;color:var(--indigo);height:52px" data-act="addGoal">Dodaj</button></div>`, "Dalej"); }
  if (st === 8) return obShell(`<h2>Których języków chcesz się uczyć?</h2><p class="soft">Możesz wybrać kilka.</p>
    <div class="opts">${Object.entries(LANGS).filter(([k]) => k !== P.native).map(([k, v]) => `<button class="opt ${S.ob.sel.includes(k) ? "sel" : ""}" data-act="pick" data-k="${k}"><b style="font-family:var(--display);font-size:22px">${v.hi}</b>${v.name}</button>`).join("")}</div>`, "Dalej");
  if (st === 9) return obShell(`<h2>${esc(greetName())}, twój plan</h2>
    ${S.ob.sel.map((k, i) => { const s = S.langs[k]?.score || 22, t = TILE[i % TILE.length]; return `<div class="bubble ${i % 2 ? "right tilt-r" : "tilt-l"}" style="background:${t.bg};color:${t.fg}"><div class="row"><b style="font-family:var(--display);font-size:30px">${LANGS[k].hi}</b><b>${band(s)[0]}</b></div><span>${LANGS[k].name}</span></div>`; }).join("")}
    <div class="card"><p>${esc(S.ob.plan || "Każdego dnia: krótka powtórka, nowy materiał i zadanie z mówienia. Na start polecam 15 minut dziennie.")}</p></div>`, "Zacznij pierwszą lekcję");
  return "";
}

/* --- Test poziomu --- */
function renderPlacement() {
  const p = S.pl, L = LANGS[p.lang];
  if (p.step === "self") return `<div class="screen bg-indigo"><span class="sticker st-sun">${esc(L.name.toUpperCase())}</span>
    <h2>Jak oceniasz swój poziom?</h2>
    <div class="opts">${SELF.map((o, i) => `<button class="opt ${p.self === i ? "sel" : ""}" data-act="plSelf" data-k="${i}">${o.l}</button>`).join("")}</div></div>
    <div class="footer bg-indigo"><button class="btn btn-sun" data-act="plNext">Dalej</button></div>`;
  if (p.step === "q") {
    const q = p.questions[p.qi];
    return `<div class="screen bg-indigo"><span class="sticker st-sun">TEST · ${p.qi + 1} Z ${p.questions.length + 1}</span>
      <h2 style="font-size:26px">${esc(q.q)}</h2>
      <div class="opts">${q.options.map((o, i) => `<button class="opt ${p.answers[p.qi] === i ? "sel" : ""}" data-act="plAns" data-k="${i}">${esc(o)}</button>`).join("")}</div></div>
      <div class="footer bg-indigo"><button class="btn btn-sun" data-act="plNext">Dalej</button></div>`;
  }
  if (p.step === "write") return `<div class="screen bg-indigo"><span class="sticker st-sun">TEST · OSTATNIE ZADANIE</span>
    <h2 style="font-size:26px">${esc(p.writing_prompt)}</h2>
    <div class="answer"><textarea class="field" id="plWrite" placeholder="Napisz albo podyktuj kilka zdań…">${esc(p.writing || "")}</textarea><button class="mic" data-act="mic" data-k="plWrite" aria-label="Odpowiedz głosem">${I.mic}</button></div></div>
    <div class="footer bg-indigo"><button class="btn btn-sun" data-act="plNext">Sprawdź poziom</button></div>`;
  if (p.step === "result") return `<div class="screen bg-indigo"><div class="grow"></div>
    <span class="sticker st-sun">${esc(L.name.toUpperCase())}</span>
    <h1 style="font-size:80px">${esc(band(p.score)[0])}</h1>
    <p class="soft">${esc(p.reason || "")}</p><div class="grow"></div></div>
    <div class="footer bg-indigo"><button class="btn btn-sun" data-act="plDone">Super, dalej</button></div>`;
  return "";
}

/* --- Główne zakładki --- */
function renderMain() {
  const v = S.view, cls = v === "home" ? "bg-indigo" : v === "cost" ? "bg-ink" : "bg-ground";
  const body = v === "home" ? renderHome() : v === "bank" ? renderBank() : v === "cost" ? renderCost() : renderMe();
  return `<div class="screen ${cls}">${body}</div>
  <div class="${cls}"><nav class="nav">${[["home", I.home, "Start"], ["bank", I.book, "Słówka"], ["cost", I.wallet, "Koszty"], ["me", I.user, "O mnie"]]
    .map(([k, ic, l]) => `<button class="${v === k ? "on" : ""}" data-act="tab" data-k="${k}" ${v === k ? 'aria-current="page"' : ""}>${ic}${l}</button>`).join("")}</nav></div>`;
}
function renderHome() {
  const langs = Object.values(S.langs).sort((a, b) => (todayDone(a.lang) ? 1 : 0) - (todayDone(b.lang) ? 1 : 0));
  const st = streak(), q = quote();
  return `<div class="blob" style="width:260px;height:260px;background:var(--indigo-2);top:-110px;right:-90px"></div>
  <div class="row" style="position:relative;align-items:flex-start"><span class="logo">STAYSI</span>${st ? `<span class="streak">${I.flame}${st} ${st === 1 ? "dzień" : "dni"}!</span>` : ""}</div>
  <h1 style="position:relative">Cześć,<br>${esc(greetName())}!</h1>
  ${langs.map((l, i) => {
    const t = TILE[i % TILE.length], done = todayDone(l.lang), right = i % 2 === 1;
    return `<div style="display:flex;flex-direction:column;${right ? "align-items:flex-end" : ""}">
      <div class="bubble lang ${right ? "right tilt-r" : "tilt-l"}" style="background:${t.bg};color:${t.fg};${right ? "width:88%" : ""}">
        <div class="row"><span class="hi">${LANGS[l.lang].hi}</span><b>${band(l.score)[0]}</b></div>
        <span style="font-weight:600">${LANGS[l.lang].name} · ${pct(l.score)}% drogi do ${nextBand(l.score)}</span>
        <div class="bar" aria-hidden="true"><i style="width:${pct(l.score)}%"></i></div>
        ${done ? `<span class="stamp">ZROBIONE DZIŚ</span><button class="go" data-act="start" data-k="${l.lang}" style="background:transparent;color:inherit;border:2px solid currentColor;font-size:15px;padding:8px 14px">Jeszcze jedna lekcja</button>`
               : `<button class="go" data-act="start" data-k="${l.lang}">Zaczynamy ${I.arrow}</button>`}
      </div></div>`;
  }).join("")}
  <button class="btn btn-ghost" data-act="addLang" style="color:var(--lilac)">¿Hola? Bonjour? <span style="color:var(--sun)">+ Nowy język</span></button>
  <div class="grow"></div>
  <p class="quote soft">„${esc(q.t)}” <b style="color:#fff">${esc(q.a)}</b></p>`;
}
const goalList = () => String(S.profile?.goal || "").split(",").map(s => s.trim()).filter(Boolean);
const setGoals = list => { S.profile.goal = list.join(", "); };
const todayDone = lang => !!S.doneDays[day(0)]?.has(lang);

function renderBank() {
  const groups = Object.keys(S.langs).map(k => {
    const items = S.bank.filter(b => b.lang === k);
    if (!items.length) return "";
    return `<div class="card"><h3>${LANGS[k].name} · ${items.length}</h3>${items.map(b => `<div class="divider"></div><div class="row">
      <div><b>${esc(b.chunk)}</b><br><span class="small muted">${esc(b.meaning)}${b.due ? ` · powtórka ${b.due <= day(0) ? "dziś" : esc(b.due)}` : ""}</span>${b.context ? `<br><span class="small" style="font-style:italic">${esc(b.context)}</span>` : ""}</div>
      <div style="display:flex;gap:10px;align-items:center"><span class="strength" aria-label="siła ${b.strength} z 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= b.strength ? "on" : ""}"></i>`).join("")}</span>
      <button class="spk" data-act="say" data-k="${esc(b.chunk)}" data-l="${k}" aria-label="Odsłuchaj">${I.speaker}</button></div></div>`).join("")}</div>`;
  }).join("");
  return `<h2>Twoje zwroty</h2><p class="small muted">Słupki to siła zwrotu w pamięci. Im silniejszy, tym rzadziej wraca.</p>${groups || `<div class="card"><p>Bank jest pusty. Stukaj w zakreślone zwroty w lekcjach, a pojawią się tutaj.</p></div>`}`;
}

function renderCost() {
  const all = S.usage, total = all.reduce((a, c) => a + Number(c.cost_usd), 0);
  const budget = Number(S.profile.budget_usd || 5), share = Math.min(100, total / budget * 100);
  const today = all.filter(c => new Date(c.created_at).toLocaleDateString("sv-SE") === day(0)).reduce((a, c) => a + Number(c.cost_usd), 0);
  const lessons = all.filter(c => c.purpose === "lesson").length;
  const avg = lessons ? total / lessons : 0;
  const models = {}; all.forEach(c => { const m = c.model.includes("sonnet") ? "Claude Sonnet 5.5" : "Claude Haiku 5.5"; models[m] = models[m] || { n: 0, v: 0, t: 0 }; models[m].n++; models[m].v += Number(c.cost_usd); models[m].t += c.input_tokens + c.output_tokens; });
  const langs = Object.keys(S.langs).map(k => ({ k, v: all.filter(c => c.lang === k).reduce((a, c) => a + Number(c.cost_usd), 0), n: all.filter(c => c.lang === k && c.purpose === "lesson").length }));
  const maxL = Math.max(0.000001, ...langs.map(l => l.v));
  const month = new Date().toLocaleDateString("pl-PL", { month: "long" });
  return `<div class="blob" style="width:240px;height:240px;background:var(--ink-2);top:-90px;right:-90px"></div>
  <span class="logo" style="position:relative">KOSZTY · ${esc(month.toUpperCase())}</span>
  <div style="position:relative;display:flex;flex-direction:column;gap:10px"><span class="big-num">${usd(total)}</span>
    <div class="bar" style="background:var(--ink-3)" aria-hidden="true"><i style="width:${share}%;background:${share >= 80 ? "var(--red)" : "var(--mint)"}"></i></div>
    <span class="small soft-2">${Math.round(share)}% z limitu ${usd(budget)}${share >= 80 ? " · zbliżasz się do limitu" : ""}</span></div>
  <div class="chips"><span class="chip" style="background:#fff;color:var(--ink);border-color:#fff">Dziś ${usd(today)}</span><span class="chip" style="background:var(--sky);color:#10265E;border-color:var(--sky)">Lekcja śr. ${lessons ? usd(avg) : "–"}</span><span class="chip" style="background:var(--mint);color:#0B3D25;border-color:var(--mint)">Lektor $0.00</span></div>
  <div class="card"><h3>Według modelu</h3>${Object.keys(models).length ? Object.entries(models).map(([m, x]) => `<div class="row"><span><b>${m}</b><br><span class="small soft-2">${x.n} zapytań · ${(x.t / 1000).toFixed(1)}k tokenów</span></span><b class="tabnum">${usd(x.v)}</b></div>`).join('<div class="divider"></div>') : '<p class="soft-2">Jeszcze nic.</p>'}</div>
  <div class="card"><h3>Według języka</h3>${langs.map(l => `<div class="row small"><span>${LANGS[l.k].name} · ${l.n} lekcji</span><b class="tabnum">${usd(l.v)}</b></div><div class="bar" style="background:var(--ink-3);height:8px"><i style="width:${l.v / maxL * 100}%;background:var(--sun)"></i></div>`).join("")}</div>
  <div class="card"><h3>Historia</h3>${all.slice(0, 15).map(c => `<div class="row small"><span>${esc(PURPOSE[c.purpose] || c.purpose)}${c.lang ? " · " + esc(LANGS[c.lang]?.name || c.lang) : ""}<br><span class="soft-2">${new Date(c.created_at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span><b class="tabnum">${usd(Number(c.cost_usd))}</b></div>`).join("") || '<p class="soft-2">Jeszcze nic.</p>'}</div>
  <div class="card"><label class="f">Miesięczny limit (USD)<input class="field" type="text" inputmode="decimal" id="budget" value="${esc(budget)}"></label>
    <button class="btn btn-sun" data-act="saveBudget" style="font-size:16px;padding:12px">Zapisz limit</button>
    <p class="small soft-2">Po przekroczeniu limitu serwer wstrzymuje zapytania do Claude do końca miesiąca albo do zmiany limitu.</p></div>`;
}

function renderMe() {
  const P = S.profile;
  return `<h2>O mnie</h2>
  <div class="card">
    <label class="f">Imię<input class="field" type="text" id="meName" value="${esc(P.name)}"></label>
    <label class="f">Czym się zajmujesz?<input class="field" type="text" id="meJob" value="${esc(P.job)}"></label>
    <label class="f">Gdzie mieszkasz?<input class="field" type="text" id="meCity" value="${esc(P.city)}"></label>
    <label class="f">Coś o tobie<textarea class="field" id="meAbout">${esc(P.about)}</textarea></label>
    <div><p class="small" style="font-weight:700;margin-bottom:6px">Zainteresowania</p><div class="chips">${[...new Set([...INTERESTS, ...(P.interests || [])])].map(i => `<button class="chip ${(P.interests || []).includes(i) ? "sel" : ""}" data-act="interest" data-k="${esc(i)}">${esc(i)}</button>`).join("")}</div></div>
    <div><p class="small" style="font-weight:700;margin-bottom:6px">Cel nauki</p><div class="chips">${[...new Set([...GOALS, ...goalList()])].map(g => `<button class="chip ${goalList().includes(g) ? "sel" : ""}" data-act="goal" data-k="${esc(g)}">${esc(g)}</button>`).join("")}</div></div>
    <label class="f">Język ojczysty<select class="field" id="meNative">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${P.native === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
    <button class="btn btn-indigo" data-act="saveMe" style="font-size:16px;padding:13px">Zapisz zmiany</button>
  </div>
  <div class="card"><h3>Języki i poziomy</h3>${Object.values(S.langs).map(l => `<div class="row"><span>${LANGS[l.lang].name} · <b>${band(l.score)[0]}</b> <span class="small muted">(${l.score} pkt)</span></span><button class="chip" data-act="retest" data-k="${l.lang}">Powtórz test</button></div>`).join('<div class="divider"></div>')}
    <button class="chip" data-act="addLang" style="align-self:flex-start">+ Dodaj język</button></div>
  <div class="card"><h3>Lektor</h3>${Object.keys(S.langs).map(k => { const list = voicesFor(k), cur = voiceFor(k), best = list.length ? quality(list[0]) : 0;
      return `<label class="f">${LANGS[k].name}<select class="field" data-voice="${k}">${list.length ? list.map(v => `<option value="${esc(v.voiceURI)}" ${cur && cur.voiceURI === v.voiceURI ? "selected" : ""}>${esc(v.name)} · ${["", "Podstawowy", "Enhanced", "Premium"][quality(v)]}</option>`).join("") : "<option>Brak głosów</option>"}</select></label>
      ${best < 2 ? `<p class="small" style="color:var(--red)">Brak naturalnego głosu. iPhone: Settings → Accessibility → Read &amp; Speak → Voices → wybierz język i pobierz wersję Premium lub Enhanced. Android: Ustawienia → Zamiana tekstu na mowę.</p>` : ""}`; }).join("")}
    <label class="f">Tempo: <span id="rateVal">${Math.round(S.rate * 100)}%</span><input type="range" id="rate" min="0.7" max="1.1" step="0.05" value="${S.rate}"></label></div>
  <div class="card"><h3>Przypomnienia</h3>
    <div class="row"><span>Codzienne przypomnienie</span><button class="toggle ${P.remind ? "on" : ""}" data-act="remind" aria-label="Przypomnienia" aria-pressed="${P.remind}"></button></div>
    <label class="f">Godzina<input class="field" type="time" id="remAt" value="${esc(P.remind_at)}"></label>
    <p class="small muted">Powiadomienia na telefon dojdą w kolejnej wersji. Godzina jest już zapisywana.</p></div>
  <div class="card"><h3>O metodzie</h3>
    <p>STAYSI opiera się na metodzie Luki Lampariello, włoskiego poligloty i trenera językowego. Każda lekcja łączy trzy filary: powtórkę (zwroty wracają w odpowiednim momencie), nowy materiał (ciekawe i zrozumiałe treści, około 85–90% znanych słów) i mówienie od pierwszego dnia.</p>
    <p><a href="https://lucalampariello.com" target="_blank" rel="noopener">Strona Luki</a> · <a href="https://www.youtube.com/@lucalampariello" target="_blank" rel="noopener">Kanał na YouTube</a></p>
    <p class="small muted">STAYSI jest inspirowana jego metodą i nie jest z nim oficjalnie powiązana.</p></div>
  <button class="btn btn-ghost" data-act="logout" style="color:var(--muted)">Wyloguj się</button>`;
}

/* --- Nakładki: czas i nowy język --- */
function renderSheet() {
  return `<div class="overlay" data-act="closeSheet"><div class="sheet" role="dialog" aria-label="Ile masz dziś czasu?">
    <div class="grab"></div><h2>Ile masz dziś<br>czasu?</h2>
    <div class="times">${TIMES.map((t, i) => `<button class="time ${i % 2 ? "tilt-r" : "tilt-l"} ${S.profile._lastTime === t.m ? "sel" : ""}" style="background:${t.bg};color:${t.fg}" data-act="time" data-k="${t.m}"><b>${t.m}<span style="font-size:17px"> min</span></b><small>${t.l}</small></button>`).join("")}</div>
    <details style="color:var(--lilac)"><summary class="small" style="cursor:pointer">Własny temat albo źródło (opcjonalnie)</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        <label class="f">Temat<input class="field" type="text" id="srcTopic" placeholder="np. zakupy na targu"></label>
        <label class="f">Link do artykułu<input class="field" type="url" id="srcUrl" placeholder="https://…"></label>
        <label class="f">Albo wklej tekst<textarea class="field" id="srcText" style="min-height:80px"></textarea></label>
      </div></details>
    <p class="small soft-2">${esc(LANGS[S.sheet].name)} · im więcej czasu, tym więcej powtórek i mówienia</p></div></div>`;
}
function renderAdd() {
  const free = Object.keys(LANGS).filter(k => k !== S.profile.native && !S.langs[k]);
  return `<div class="overlay" data-act="closeAdd"><div class="sheet" role="dialog" aria-label="Nowy język"><div class="grab"></div><h2>Nowy język</h2>
    ${free.length ? `<div class="opts">${free.map(k => `<button class="opt" data-act="addPick" data-k="${k}"><b style="font-family:var(--display);font-size:22px">${LANGS[k].hi}</b>${LANGS[k].name}</button>`).join("")}</div>` : "<p>Uczysz się już wszystkich dostępnych języków.</p>"}
  </div></div>`;
}

/* --- Lekcja --- */
function lessonBg() { const L = S.L; return L.stage === "review" ? "bg-blue" : L.stage === "mat" ? "bg-green" : L.stage === "act" ? "bg-coral" : "bg-indigo"; }
function progress() {
  const L = S.L, total = L.cards.length + L.retry.length;
  const r = L.first ? 0 : L.stage === "review" ? (L.introSeen ? L.i / Math.max(1, total) : 0) : 1;
  const steps = L.C.mode === "C" ? 3 : 4;
  const a = L.stage === "review" ? 0 : L.stage === "mat" ? (L.step + 1) / steps : 1;
  const c = L.stage === "act" ? (L.fb ? 1 : 0.4) : L.stage === "sum" ? 1 : 0;
  return `<div class="lbar"><button class="x" data-act="quit" aria-label="Zamknij lekcję">${I.close}</button>
  <div class="segs" aria-hidden="true"><div class="seg r"><i style="width:${r * 100}%"></i></div><div class="seg a"><i style="width:${a * 100}%"></i></div><div class="seg c"><i style="width:${c * 100}%"></i></div></div></div>`;
}
function renderLesson() {
  const L = S.L, cls = lessonBg();
  if (L.stage === "sum") return renderSum();
  const inner = L.stage === "review" ? renderReview() : L.stage === "mat" ? renderMat() : renderAct();
  return `<div class="${cls}" style="display:flex;flex-direction:column;flex:1;min-height:0">${progress()}${inner}</div>`;
}
function renderReview() {
  const L = S.L;
  if (!L.introSeen) {
    if (L.C.mode === "C") {
      const items = S.bank.filter(b => b.lang === L.lang).slice(0, 8);
      return `<div class="screen"><span class="sticker st-sun">POWTÓRKA · SKARBIEC</span><h2>Twój Skarbiec</h2>
        <p style="color:#D6E2FF">Słowa z czytania razem ze zdaniem, z którego pochodzą.</p>
        <div class="card">${items.map(b => `<div class="row"><div><b>${esc(b.chunk)}</b> · <span class="muted">${esc(b.meaning)}</span>${b.context ? `<br><span class="small" style="font-style:italic">${esc(b.context)}</span>` : ""}</div><button class="spk" data-act="say" data-k="${esc(b.context || b.chunk)}" data-l="${L.lang}" aria-label="Odsłuchaj">${I.speaker}</button></div>`).join('<div class="divider"></div>')}</div></div>
        <div class="footer"><button class="btn btn-white" style="color:var(--blue)" data-act="introDone">Dalej: ${L.cards.length} kart</button></div>`;
    }
    const prev = L.prev?.lines || [];
    return `<div class="screen"><span class="sticker st-sun">POWTÓRKA</span><h2>Rozgrzewka pamięci</h2>
      <p style="color:#D6E2FF">Najpierw posłuchaj poprzedniej lekcji. Potem ${L.cards.length} ${L.cards.length < 5 ? "karty" : "kart"} z twoimi zwrotami.</p>
      ${prev.length ? `<div class="card">${prev.map(l => `<p><span class="small muted">${esc(l.speaker)}:</span> ${esc(l.text)}</p>`).join("")}</div>
      <button class="pillbtn" style="background:var(--sun);color:var(--ink);align-self:flex-start" data-act="playPrev">${I.speaker} Odsłuchaj</button>` : ""}</div>
      <div class="footer"><button class="btn btn-white" style="color:var(--blue)" data-act="introDone">Dalej</button></div>`;
  }
  const card = [...L.cards, ...L.retry][L.i], fb = L.cardFb, b = S.bank.find(x => x.lang === L.lang && x.chunk === card.chunk);
  return `<div class="screen"><div class="row"><span class="sticker st-sun">POWTÓRKA</span><span class="small" style="color:#D6E2FF;font-weight:700">${L.i + 1}/${L.cards.length + L.retry.length}</span></div>
    <div><p style="color:#D6E2FF">Jak powiesz w języku: ${esc(LANGS[L.lang].name.toLowerCase())}?</p><h2 style="font-size:32px">„${esc(card.prompt_native)}”</h2></div>
    <div class="gapcard"><span>${esc(card.before)}</span><span class="slot">${fb ? `<span style="color:${fb.ok ? "#137A48" : "var(--red)"}">${esc(card.answer)}</span>` : ""}</span><span>${esc(card.after)}</span></div>
    ${fb ? `<div class="verdict ${fb.ok ? "ok" : "bad"}">${esc(fb.text)}</div>` : `<div class="answer"><label class="f" style="flex:1;color:#D6E2FF">Twoja odpowiedź<input class="field" type="text" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false"></label><button class="mic" data-act="mic" data-k="ans" aria-label="Odpowiedz głosem">${I.mic}</button></div>`}
    <div class="grow"></div>
    ${b ? `<div class="row" style="justify-content:center"><span class="small" style="color:#D6E2FF">Siła zwrotu</span><span class="strength">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= b.strength ? "on" : ""}"></i>`).join("")}</span></div>` : ""}</div>
    <div class="footer"><button class="btn btn-white" style="color:var(--blue)" data-act="${fb ? "nextCard" : "check"}">${fb ? "Dalej" : "Sprawdź"}</button></div>`;
}
function chunked(line) {
  let html = esc(line.text);
  (line.chunks || []).forEach(c => {
    const e = esc(c.text); if (!e || !html.includes(e)) return;
    const added = S.L.added.includes(c.text);
    html = html.replace(e, `<span class="ch ${added ? "added" : ""}" role="button" tabindex="0" data-act="chunk" data-k="${e}">${e}</span>`);
  });
  return html;
}
function renderMat() {
  const L = S.L, C = L.C, step = L.step, isC = C.mode === "C", baroStep = isC ? 2 : 3;
  if (step === baroStep) return `<div class="screen"><span class="sticker st-sun">JAK POSZŁO?</span><h2>Jak ci się ${isC ? "czytało" : "słuchało"}?</h2>
    <p style="color:#CDEBDD">Odpowiedź ustawi trudność kolejnych lekcji.</p>
    <div class="baro">${[["Za łatwe", "zzz", 1], ["W sam raz", "ok!", 0], ["Za trudne", "uff", -1]].map(([l, e, v]) => `<button data-act="baro" data-k="${v}" data-l="${l}"><span>${e}</span>${l}</button>`).join("")}</div></div>`;
  const label = isC ? ["CZYTANIE", "SŁUCHANIE"][step] : ["KROK 1 · TŁUMACZENIE", "KROK 2 · ORYGINAŁ", "KROK 3 · SŁUCHANIE"][step];
  let body = "";
  if (isC) {
    body = C.lines.map((ln, i) => `<div class="para ${L.hl === i ? "hl" : ""}"><div style="flex:1">${chunked(ln)}${L.showTr[i] ? `<span class="tr">${esc(ln.translation)}</span>` : ""}</div>
      <div class="tools"><button class="spk" data-act="sayLine" data-k="${i}" aria-label="Odsłuchaj akapit">${I.speaker}</button><button class="spk" data-act="trToggle" data-k="${i}" aria-label="Pokaż tłumaczenie" style="font-size:11px;font-weight:800">PL</button></div></div>`).join("");
  } else {
    body = C.lines.map((ln, i) => `<div class="msg ${ln.me ? "me" : ""} ${L.hl === i ? "hl" : ""}"><span class="who">${esc(ln.speaker)}</span>
      <div class="b"><span>${step === 0 ? esc(ln.translation) : chunked(ln)}</span>${step > 0 ? `<button class="spk" data-act="sayLine" data-k="${i}" aria-label="Odsłuchaj">${I.speaker}</button>` : ""}</div></div>`).join("");
  }
  const tip = L.tip ? `<div class="tip"><b>${esc(L.tip.text)}</b> = ${esc(L.tip.meaning)}<br>Zapisane w twoim banku</div>` : "";
  const hint = (isC && step === 0) ? `<p class="small" style="color:#CDEBDD">Czytasz od razu oryginał. PL pokazuje tłumaczenie akapitu, gdy utkniesz. Stuknięte słowo trafia do Skarbca.</p>`
    : (!isC && step === 1) ? `<p class="small" style="color:#CDEBDD">Stuknij zakreślony zwrot, żeby go zapisać.</p>` : "";
  const listen = ((isC && step === 1) || (!isC && step === 2)) ? `<button class="pillbtn" style="background:var(--sun);color:var(--ink);align-self:flex-start" data-act="playAll">${I.speaker} Odtwórz całość</button>` : "";
  const photo = (isC && step === 0) ? `<label class="btn btn-ghost" for="pages" style="color:#fff;cursor:pointer">Dodaj zdjęcie strony z własnej książki</label><input type="file" id="pages" accept="image/*" style="display:none">` : "";
  return `<div class="screen"><span class="sticker st-sun">${label}</span>
    <div><h2 style="font-size:36px">${esc(C.title)}</h2><p style="color:#CDEBDD">${esc(C.intro)}</p></div>
    ${hint}${listen}<div style="display:flex;flex-direction:column;gap:10px">${body}</div>${tip}${photo}</div>
    <div class="footer"><button class="btn btn-white" style="color:var(--green)" data-act="matNext">Dalej</button></div>`;
}
function renderAct() {
  const L = S.L, A = L.C.activation || {}, isC = L.C.mode === "C";
  if (L.fb) {
    const f = L.fb;
    return `<div class="screen"><div class="row"><span class="sticker st-coral">MÓWIENIE · ${esc((A.name || "").toUpperCase())}</span><span class="streak" style="font-size:16px">Brawo!</span></div>
      <div class="msg me" style="max-width:100%"><span class="who">Ty</span><div class="b" style="background:#fff">${esc(isC ? L.rounds[L.rounds.length - 1] : L.answer)}</div></div>
      <div class="msg" style="max-width:100%"><span class="who">Claude</span><div class="claude">
        <p style="color:var(--lilac)">${esc(f.praise)}</p>
        <p style="font-family:var(--display);font-weight:800;font-size:21px;line-height:1.25">${esc(f.corrected)}</p>
        <button class="pillbtn" style="background:var(--sun);color:var(--ink);align-self:flex-start" data-act="sayFix">${I.speaker} Odsłuchaj</button></div></div>
      <div class="fixes">${(f.fixes || []).map((x, i) => `<div style="display:flex;gap:12px"><span class="num">${i + 1}</span><p class="small" style="font-size:15px">${esc(x)}</p></div>`).join("")}
        ${(f.more || []).length ? (L.showMore ? `<p class="small muted">${(f.more || []).map(esc).join("<br>")}</p>` : `<a href="#" data-act="showMore">Pokaż wszystkie poprawki</a>`) : ""}</div></div>
      <div class="footer"><button class="btn btn-coral" data-act="finish">Zakończ lekcję</button></div>`;
  }
  const r = (L.rounds || []).length;
  const roundInfo = isC ? `<div class="chips">${[3, 2, 1].map((m, i) => `<span class="chip ${i === r ? "sel" : ""}" style="border-color:rgba(30,27,58,.2);${i < r ? "opacity:.5;text-decoration:line-through" : ""}">Runda ${i + 1}: ${m} min</span>`).join("")}</div>
    <p class="small muted">${r === 0 ? "Mów albo pisz swobodnie przez około 3 minuty." : r === 1 ? "Ta sama treść w 2 minuty. Wyrzuć mniej ważne rzeczy." : "Ostatnia runda: 1 minuta, tylko sedno."}</p>` : "";
  return `<div class="screen"><span class="sticker st-coral">MÓWIENIE · ${esc((A.name || "").toUpperCase())}</span>
    <h2 style="font-size:28px">${esc(A.task)}</h2>
    ${(A.chunks || []).length ? `<div class="chips">${A.chunks.map(c => `<span class="chip sel">${esc(c)}</span>`).join("")}</div>` : ""}
    ${A.hint ? `<p class="small muted">${esc(A.hint)}</p>` : ""}${roundInfo}
    <div class="answer"><textarea class="field" id="act" placeholder="Napisz albo podyktuj…"></textarea><button class="mic" data-act="mic" data-k="act" aria-label="Odpowiedz głosem">${I.mic}</button></div></div>
    <div class="footer"><button class="btn btn-coral" data-act="actSend">${isC && r < 2 ? `Gotowe, runda ${r + 2}` : "Sprawdź z Claude"}</button></div>`;
}
function renderSum() {
  const L = S.L, st = streak(), q = quote(), due = S.bank.filter(b => b.lang === L.lang && b.due <= day(1)).length;
  return `<div class="screen bg-indigo">
    <div class="blob" style="width:280px;height:280px;background:var(--indigo-2);bottom:-120px;left:-100px"></div>
    <div class="row" style="justify-content:flex-start;gap:14px;position:relative"><div style="width:74px;height:74px;border-radius:24px;background:var(--sun);display:flex;align-items:center;justify-content:center;transform:rotate(-6deg);box-shadow:0 5px 0 var(--sun-dark)">${I.check}</div>
      ${st ? `<span class="streak" style="background:#fff">${I.flame}${st} ${st === 1 ? "dzień" : "dni"} z rzędu!</span>` : ""}</div>
    <h1 style="font-size:54px;position:relative">Brawo,<br>${esc(greetName())}!</h1>
    <div style="display:flex;flex-direction:column;gap:10px;position:relative">
      <div class="bubble tilt-l" style="align-self:flex-start;background:var(--mint);color:#0B3D25;padding:12px 18px"><b style="font-family:var(--display);font-size:30px">${L.added.length}</b> nowych zwrotów</div>
      ${L.first ? "" : `<div class="bubble right tilt-r" style="align-self:flex-end;background:var(--sky);color:#10265E;padding:12px 18px"><b style="font-family:var(--display);font-size:30px">${L.ok}/${L.total}</b> powtórek dobrze</div>`}
      <div class="bubble tilt-l" style="align-self:flex-start;background:var(--coral-2);color:#4A1405;padding:12px 18px"><b style="font-family:var(--display);font-size:30px">1</b> zadanie z mówienia</div></div>
    <div class="btn-ghost" style="border-radius:20px;padding:10px 16px;color:var(--lilac);position:relative">Jutro czeka <b style="color:var(--sun)">${due}</b> zwrotów do powtórki</div>
    <div class="grow"></div><p class="quote soft" style="position:relative">„${esc(q.t)}”<br><b style="color:#fff">${esc(q.a)}</b></p></div>
    <div class="footer bg-indigo"><button class="btn btn-sun" data-act="home">Wróć do startu</button></div>`;
}

/* ================= Po renderze ================= */
let greetTimer = null;
function afterRender() {
  clearInterval(greetTimer);
  const g = $("#greet");
  if (g) { const w = Object.values(LANGS).map(l => l.hi); let i = 0; greetTimer = setInterval(() => { g.style.opacity = 0; setTimeout(() => { i = (i + 1) % w.length; g.textContent = w[i]; g.style.opacity = 1; }, 300); }, 1400); }
  const f = $("#authForm"); if (f) f.addEventListener("submit", onAuth);
  const ans = $("#ans"); if (ans) { ans.focus({ preventScroll: true }); ans.addEventListener("keydown", e => { if (e.key === "Enter") act("check"); }); }
  const nm = $("#name"); if (nm) nm.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); act("obNext"); } });
  document.querySelectorAll("select[data-voice]").forEach(sel => sel.addEventListener("change", () => { S.voice[sel.dataset.voice] = sel.value; saveLocal("staysiVoices", S.voice); speak(LANGS[sel.dataset.voice].hi, sel.dataset.voice); }));
  const rt = $("#rate"); if (rt) rt.addEventListener("input", () => { S.rate = +rt.value; $("#rateVal").textContent = Math.round(S.rate * 100) + "%"; saveLocal("staysiRate", S.rate); });
  const pg = $("#pages"); if (pg) pg.addEventListener("change", () => onPhoto(pg.files[0]));
}

/* ================= Zdarzenia ================= */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.classList.contains("overlay") && e.target !== el) return;
  if (el.tagName === "A") e.preventDefault();
  act(el.dataset.act, el.dataset.k, el);
});
document.addEventListener("keydown", e => {
  const el = e.target.closest?.('[role="button"][data-act]');
  if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); act(el.dataset.act, el.dataset.k, el); }
});

async function onAuth(e) {
  e.preventDefault();
  const email = $("#email").value.trim(), password = $("#pass").value;
  S.auth.email = email;
  S.busy = S.auth.mode === "register" ? "Zakładam konto…" : "Loguję…"; render();
  try {
    if (S.auth.mode === "register") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw new Error(error.message.includes("Signups not allowed") || error.message.includes("signup") ? "Rejestracja jest zamknięta." : error.message);
      if (!data.session) { S.auth = { mode: "login", email, msg: "Sprawdź skrzynkę i kliknij link potwierdzający. Potem zaloguj się tutaj." }; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message.includes("Invalid") ? "Zły e-mail albo hasło." : error.message.includes("confirm") ? "Najpierw potwierdź e-mail linkiem ze skrzynki." : error.message.includes("Signups not allowed") || error.message.includes("signup") ? "Rejestracja jest zamknięta." : error.message);
    }
  } catch (err) {
    S.auth.msg = err.message || "Nie udało się. Spróbuj ponownie.";
  } finally { S.busy = null; render(); }
}

function startPlacement(lang, after) {
  S.pl = { lang, step: "self", self: undefined, questions: [], qi: 0, answers: [], after };
  S.view = "placement"; render(); scrollTop();
}
async function finishPlacement(score, reason) {
  const p = S.pl;
  if (!S.langs[p.lang] || S.langs[p.lang].score !== score) {
    const { data } = await sb.from("user_languages").upsert({ user_id: uid(), lang: p.lang, score }, { onConflict: "user_id,lang" }).select().single();
    S.langs[p.lang] = data || { lang: p.lang, score, lessons_done: 0, difficulty_shift: 0 };
  }
  p.score = score; p.reason = reason; p.step = "result"; render(); scrollTop();
}

async function act(a, k, el) {
  const L = S.L, P = S.profile;
  switch (a) {
    case "authMode": S.auth = { mode: S.auth.mode === "login" ? "register" : "login", msg: "" }; return render();
    case "tab": S.view = k; render(); return scrollTop();
    case "say": return speak(k, el.dataset.l);
    case "mic": return dictate(k, L?.lang || S.pl?.lang || "en", el);

    /* pierwsze uruchomienie */
    case "obNext": return obNext();
    case "native": P.native = k; S.ob.sel = S.ob.sel.filter(x => x !== k); return render();
    case "interest": { const list = P.interests || []; P.interests = list.includes(k) ? list.filter(x => x !== k) : [...list, k]; if (S.view === "me") return render(); return render(); }
    case "addInterest": { const v = $("#ownInt").value.trim(); if (v && !(P.interests || []).includes(v)) P.interests = [...(P.interests || []), v]; return render(); }
    case "goal": { const g = goalList(); setGoals(g.includes(k) ? g.filter(x => x !== k) : [...g, k]); return render(); }
    case "addGoal": { const v = $("#ownGoal").value.trim(); if (v && !goalList().includes(v)) setGoals([...goalList(), v]); return render(); }
    case "pick": S.ob.sel = S.ob.sel.includes(k) ? S.ob.sel.filter(x => x !== k) : [...S.ob.sel, k]; return render();

    /* test poziomu */
    case "plSelf": S.pl.self = +k; return render();
    case "plAns": S.pl.answers[S.pl.qi] = +k; return render();
    case "plNext": return plNext();
    case "plDone": { const after = S.pl.after; S.pl = null; return after(); }

    /* start i zakładki */
    case "start": S.sheet = k; return render();
    case "closeSheet": S.sheet = null; return render();
    case "time": return startLesson(S.sheet, +k);
    case "addLang": S.add = true; return render();
    case "closeAdd": S.add = null; return render();
    case "addPick": S.add = null; return startPlacement(k, () => { S.view = "home"; render(); });
    case "retest": return startPlacement(k, () => { S.view = "me"; render(); });
    case "saveBudget": { const v = parseFloat(($("#budget").value || "").replace(",", ".")); if (!(v > 0)) return toast("Wpisz kwotę większą od zera."); await saveProfile({ budget_usd: v }); toast("Limit zapisany."); return render(); }
    case "saveMe": {
      const name = $("#meName").value.trim() || P.name;
      const fields = { name, job: $("#meJob").value, city: $("#meCity").value, about: $("#meAbout").value, interests: P.interests || [], goal: P.goal || "", native: $("#meNative").value, remind_at: $("#remAt").value };
      if (name !== P.name || fields.native !== P.native) fields.name_vocative = await vocative(name, fields.native);
      await saveProfile(fields); toast("Zapisano."); return render();
    }
    case "remind": await saveProfile({ remind: !P.remind }); return render();
    case "logout": await sb.auth.signOut(); return;

    /* lekcja */
    case "quit": stopSpeech(); S.L = null; S.view = "home"; toast("Lekcja przerwana. Zwroty z banku zostały zapisane."); return render();
    case "introDone": L.introSeen = true; render(); return scrollTop();
    case "playPrev": return speak((L.prev?.lines || []).map(l => l.text).join(" "), L.lang);
    case "check": return checkCard();
    case "nextCard": L.cardFb = null; L.i++; if (L.i >= L.cards.length + L.retry.length) { L.stage = "mat"; L.step = 0; } render(); return scrollTop();
    case "chunk": {
      const line = L.C.lines.find(l => (l.chunks || []).some(c => esc(c.text) === k));
      const c = line?.chunks.find(c => esc(c.text) === k); if (!c) return;
      L.tip = c; if (!L.added.includes(c.text)) { L.added.push(c.text); await addToBank(L.lang, c.text, c.meaning, line.text); }
      speak(c.text, L.lang); return render();
    }
    case "sayLine": { const i = +k; L.hl = i; render(); return speak(L.C.lines[i].text, L.lang, () => { L.hl = -1; render(); }); }
    case "trToggle": L.showTr[+k] = !L.showTr[+k]; return render();
    case "playAll": { let i = 0; const next = () => { if (i >= L.C.lines.length || S.view !== "lesson" || S.L !== L) { L.hl = -1; render(); return; } L.hl = i; render(); speak(L.C.lines[i].text, L.lang, () => { i++; next(); }); }; return next(); }
    case "matNext": stopSpeech(); L.hl = -1; L.tip = null; L.step++; render(); return scrollTop();
    case "baro": {
      L.baro = el.dataset.l; const shift = Math.max(-3, Math.min(3, (S.langs[L.lang].difficulty_shift || 0) + Number(k)));
      if (shift !== S.langs[L.lang].difficulty_shift) { S.langs[L.lang].difficulty_shift = shift; sb.from("user_languages").update({ difficulty_shift: shift }).eq("id", S.langs[L.lang].id); }
      toast(k === "0" ? "Super, trzymamy poziom." : k === "1" ? "Następne lekcje będą trochę trudniejsze." : "Następne lekcje będą trochę łatwiejsze.");
      L.stage = "act"; render(); return scrollTop();
    }
    case "actSend": return sendActivation();
    case "sayFix": return speak(L.fb.corrected, L.lang);
    case "showMore": L.showMore = true; return render();
    case "finish": return finishLesson();
    case "home": S.L = null; S.view = "home"; render(); return scrollTop();
  }
}

async function vocative(name, native) {
  if (native !== "pl" || !name) return name;
  try { const r = await ai("vocative", { name }); return r.vocative || name; } catch { return name; }
}

async function obNext() {
  const st = S.ob.step, P = S.profile;
  if (st === 4) { const n = $("#name").value.trim(); if (!n) return toast("Wpisz swoje imię."); P.name = n; }
  if (st === 5) { P.job = $("#job").value; P.city = $("#city").value; P.about = $("#about").value; }
  if (st === 7) {
    if (!goalList().length) return toast("Wybierz co najmniej jeden cel.");
    await withBusy("Zapisuję twój profil…", async () => {
      const name_vocative = await vocative(P.name, P.native);
      await saveProfile({ name: P.name, name_vocative, native: P.native, job: P.job, city: P.city, about: P.about, interests: P.interests || [], goal: P.goal });
    });
  }
  if (st === 8) {
    if (!S.ob.sel.length) return toast("Wybierz co najmniej jeden język.");
    S.ob.idx = 0;
    const runNext = () => {
      if (S.ob.idx < S.ob.sel.length) { const lang = S.ob.sel[S.ob.idx++]; return startPlacement(lang, runNext); }
      S.view = "ob"; S.ob.step = 9; render();
      withBusy("Claude układa twój plan…", async () => { const r = await ai("plan", {}); S.ob.plan = r.plan; });
    };
    return runNext();
  }
  if (st === 9) {
    await saveProfile({ onboarded: true });
    S.view = "home"; render(); S.sheet = S.ob.sel[0]; return render();
  }
  S.ob.step++; render(); scrollTop();
}

async function plNext() {
  const p = S.pl;
  if (p.step === "self") {
    if (p.self === undefined) return toast("Wybierz jedną odpowiedź.");
    if (p.self === 0) return finishPlacement(22, "Zaczynasz od zera, więc startujemy od A1. Pierwsze lekcje będą krótkie i proste.");
    return withBusy("Claude przygotowuje krótki test…", async () => {
      const r = await ai("placement_questions", { lang: p.lang, self_score: SELF[p.self].s });
      p.questions = (r.questions || []).filter(q => Array.isArray(q.options)).slice(0, 5); p.writing_prompt = r.writing_prompt || "Napisz kilka zdań o sobie.";
      p.step = p.questions.length ? "q" : "write"; p.qi = 0;
    });
  }
  if (p.step === "q") {
    if (p.answers[p.qi] === undefined) return toast("Wybierz odpowiedź.");
    if (p.qi < p.questions.length - 1) { p.qi++; return render(); }
    p.step = "write"; return render();
  }
  if (p.step === "write") {
    p.writing = $("#plWrite").value;
    return withBusy("Claude sprawdza twój poziom…", async () => {
      const answers = p.questions.map((q, i) => ({ q: q.q, chosen: q.options[p.answers[i]], correct: q.options[q.correct] }));
      const r = await ai("placement_grade", { lang: p.lang, self_score: SELF[p.self].s, answers, writing: p.writing });
      await finishPlacement(r.score, r.reason);
    });
  }
}

/* --- Lekcja: start, karty, aktywacja, koniec --- */
async function startLesson(lang, minutes) {
  const topic = $("#srcTopic")?.value.trim() || "", source_url = $("#srcUrl")?.value.trim() || "", source_text = $("#srcText")?.value.trim() || "";
  S.sheet = null; S.profile._lastTime = minutes;
  const ul = S.langs[lang], first = (ul.lessons_done || 0) === 0;
  const n = TIMES.find(t => t.m === minutes).n;
  await withBusy("Claude układa twoją lekcję…", async () => {
    const pool = S.bank.filter(b => b.lang === lang).sort((a, b) => (a.due <= day(0) ? 0 : 1) - (b.due <= day(0) ? 0 : 1) || a.strength - b.strength).slice(0, n);
    const [lesson, review, prev] = await Promise.all([
      ai("lesson", { lang, minutes, topic, source_url, source_text }),
      !first && pool.length ? ai("review", { lang, chunks: pool.map(b => ({ chunk: b.chunk, meaning: b.meaning, context: b.context })) }) : Promise.resolve({ cards: [] }),
      !first ? sb.from("lessons").select("content").eq("lang", lang).not("completed_at", "is", null).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] })
    ]);
    const cards = (review.cards || []).filter(c => c.answer && c.prompt_native);
    S.L = { lang, minutes, id: lesson.lesson_id, C: lesson.content, first, prev: prev.data?.[0]?.content || null,
      stage: first || !cards.length ? "mat" : "review", introSeen: false, i: 0, cards, retry: [], ok: 0, total: 0, cardFb: null,
      step: 0, hl: -1, tip: null, added: [], showTr: {}, rounds: [], fb: null };
    S.view = "lesson";
  });
  await reloadUsage();
  if (S.L) scrollTop();
}

async function checkCard() {
  const L = S.L, input = $("#ans"); const given = input.value.trim();
  if (!given) return toast("Wpisz albo podyktuj odpowiedź.");
  const card = [...L.cards, ...L.retry][L.i];
  const g = norm(given), exp = norm(card.answer);
  let ok = g === exp || (exp.length > 4 && lev(g, exp) <= 1), text = "";
  if (!ok) {
    const r = await withBusy("Sprawdzam…", () => ai("check", { lang: L.lang, prompt_native: card.prompt_native, before: card.before, after: card.after, expected: card.answer, given }));
    if (r) { ok = !!r.ok; text = r.explanation || ""; }
  }
  L.total++; if (ok) L.ok++; else if (!L.retry.includes(card)) L.retry.push(card);
  const b = S.bank.find(x => x.lang === L.lang && x.chunk === card.chunk);
  if (b) {
    b.strength = ok ? Math.min(5, b.strength + 1) : Math.max(0, b.strength - 1);
    b.due = day(ok ? INTERVAL[b.strength] : 1);
    sb.from("bank").update({ strength: b.strength, due: b.due }).eq("id", b.id);
  }
  L.cardFb = { ok, text: ok ? (text || `Dobrze! Następna powtórka ${b ? (INTERVAL[b.strength] === 1 ? "jutro" : `za ${INTERVAL[b.strength]} dni`) : "za kilka dni"}.`) : (text ? text + " " : "") + "Wróci jeszcze na końcu powtórki." };
  speak(`${card.before} ${card.answer} ${card.after}`, L.lang);
  render();
}

async function sendActivation() {
  const L = S.L, isC = L.C.mode === "C", t = $("#act").value.trim();
  if (!t) return toast("Napisz albo podyktuj odpowiedź.");
  if (isC && L.rounds.length < 2) { L.rounds.push(t); render(); return scrollTop(); }
  if (isC) L.rounds.push(t); else L.answer = t;
  const r = await withBusy("Claude czyta twoją odpowiedź…", () => ai("feedback", { lang: L.lang, task: L.C.activation?.task || "", ...(isC ? { rounds: L.rounds } : { answer: t }) }));
  if (!r) { if (isC) L.rounds.pop(); return render(); }
  L.fb = r;
  for (const c of (r.new_chunks || []).slice(0, 4)) { if (await addToBank(L.lang, c.text, c.meaning, r.corrected)) L.added.push(c.text); }
  L.estimate = Number(r.score_estimate) || null;
  await reloadUsage(); render(); scrollTop();
}

async function finishLesson() {
  const L = S.L, ul = S.langs[L.lang];
  await withBusy("Zapisuję postęp…", async () => {
    let score = ul.score;
    if (L.estimate) {
      const est = Math.max(10, Math.min(90, L.estimate));
      if ((ul.lessons_done || 0) < 5) score = Math.round(score + (est - score) * 0.4);      // kalibracja: w obie strony
      else if (est > score) score = score + (est >= score + 8 ? 2 : 1);                     // potem tylko w górę
      score = Math.max(22, Math.min(90, score));
    }
    const before = band(ul.score)[0];
    ul.score = score; ul.lessons_done = (ul.lessons_done || 0) + 1;
    await Promise.all([
      sb.from("user_languages").update({ score, lessons_done: ul.lessons_done }).eq("id", ul.id),
      sb.from("lessons").update({ completed_at: new Date().toISOString(), barometer: L.baro || null }).eq("id", L.id)
    ]);
    (S.doneDays[day(0)] = S.doneDays[day(0)] || new Set()).add(L.lang);
    if (band(score)[0] !== before) toast(ul.lessons_done <= 5 ? `Dopasowaliśmy twój poziom: ${band(score)[0]}.` : `Awans! Twój poziom to teraz ${band(score)[0]}.`);
    L.stage = "sum";
  });
  scrollTop();
}

async function onPhoto(file) {
  if (!file) return;
  const L = S.L;
  const dataUrl = await new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
    img.onerror = rej; img.src = url;
  }).catch(() => null);
  if (!dataUrl) return toast("Nie udało się wczytać zdjęcia.");
  const r = await withBusy("Claude czyta stronę…", () => ai("photo", { lang: L.lang, image: dataUrl }));
  if (!r) return;
  let n = 0; for (const w of (r.words || [])) { if (await addToBank(L.lang, w.chunk, w.meaning, w.context)) n++; }
  await reloadUsage();
  toast(n ? `Dodano ${n} słów do Skarbca.` : "Nie znalazłem nowych słów na tym zdjęciu.");
}

/* ================= Start aplikacji ================= */
async function boot() {
  let cfg;
  try { cfg = await (await fetch("/api/config")).json(); } catch { cfg = {}; }
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { S.view = "setup"; return render(); }
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data } = await sb.auth.getSession();
  await onSession(data.session);
  sb.auth.onAuthStateChange((_e, session) => { if ((session?.user?.id || null) !== (S.session?.user?.id || null)) onSession(session); });
}
async function onSession(session) {
  S.session = session;
  if (!session) { S.view = "auth"; return render(); }
  S.view = "loading"; render();
  await loadAll();
  if (!S.profile.onboarded) {
    S.ob = { step: 0, sel: Object.keys(S.langs), self: {}, idx: 0 };
    S.profile.native = S.profile.native || "pl"; S.view = "ob";
  } else S.view = "home";
  render();
}
boot();

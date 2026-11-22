// STAYSI: ekran języka i bank słówek (fiszki z powtórkami rozłożonymi w czasie).
// Moduł dostaje z app.js wspólne narzędzia przez init(ctx).
import { forLang, CATS, topicMap } from "./learn.js";
let C = null; // { S, sb, ai, esc, speak, toast, withBusy, render, scrollTop, day, uid, LANGS, flag, band, pct, nextBand, I }

const LESSON = 8;                         // nowych słówek w jednej lekcji
const INT = [0, 1, 3, 7, 14, 30];         // dni do powtórki według siły (1-5)
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/[’']/g, "").replace(/-/g, " ").replace(/[.,!?;:…„”"¡¿«»()]/g, "").replace(/\s+/g, " ").trim().replace(/^(to|zu) /, "");
function lev(a, b) { const m = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i; for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return m[b.length]; }

export function init(ctx) { C = ctx; }

/* ---------- dane ---------- */
const all = lang => C.S.bank.filter(b => b.lang === lang);
const fresh = lang => all(lang).filter(b => b.introduced === false);
const learned = lang => all(lang).filter(b => b.introduced !== false);
const due = lang => learned(lang).filter(b => b.due <= C.day(0));
const solid = lang => learned(lang).filter(b => b.strength >= 4);
export const dueCount = lang => due(lang).length;

const answerOf = w => ((w.ex || "").match(/\{(.*?)\}/) || [])[1] || w.chunk;
function sentence(w, mode) { // mode: gap | full | plain
  let ex = w.ex;
  if (!ex) { const c = w.context || ""; ex = c && c.toLowerCase().includes(w.chunk.toLowerCase()) ? c.replace(new RegExp(w.chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), m => `{${m}}`) : ""; }
  if (!ex) return mode === "plain" ? w.chunk : mode === "gap" ? '<span class="wgap"></span>' : `<b>${C.esc(w.chunk)}</b>`;
  const parts = ex.split(/\{(.*?)\}/);
  if (mode === "plain") return parts.join("");
  return parts.map((p, i) => i % 2 ? (mode === "gap" ? '<span class="wgap"></span>' : `<b>${C.esc(p)}</b>`) : C.esc(p)).join("");
}
const spk = (text, lang) => `<button class="spk" data-act="say" data-k="${C.esc(text)}" data-l="${lang}" aria-label="Odsłuchaj">${C.I.speaker}</button>`;

async function save(w, fields) {
  Object.assign(w, fields);
  if (w.id) { const { error } = await C.sb.from("bank").update(fields).eq("id", w.id); if (error) C.toast("Nie udało się zapisać postępu słówka."); }
}

// Uzupełnia karty (zdanie, wymowa, wskazówka) dla słówek, które ich nie mają
async function enrich(lang, words) {
  const need = words.filter(w => !w.ex);
  for (let i = 0; i < need.length; i += 8) {
    const batch = need.slice(i, i + 8);
    const r = await C.ai("enrich", { lang, words: batch.map(w => ({ chunk: w.chunk, meaning: w.meaning, context: w.context })) });
    for (const card of (r.words || [])) {
      const w = batch.find(x => norm(x.chunk) === norm(card.chunk)) || batch[(r.words || []).indexOf(card)];
      if (w) await save(w, { meaning: w.meaning || card.meaning || "", pron: card.pron || "", ex: card.ex || "", ex_pl: card.ex_pl || "", tip: card.tip || "", fam: Array.isArray(card.fam) ? card.fam : [] });
    }
  }
}

/* ---------- karta słówka ---------- */
function famHtml(w, lang) {
  if (!Array.isArray(w.fam) || !w.fam.length) return "";
  return `<div class="wfam"><span class="lbl">Rodzina słowa · dotknij, żeby usłyszeć</span>${w.fam.map(f => `<span class="f" role="button" tabindex="0" data-act="say" data-k="${C.esc(f[0])}" data-l="${lang}"><b>${C.esc(f[0])}</b>${f[1] ? ` <i>${C.esc(f[1])}</i>` : ""} ${C.esc(f[2] || "")}${f[3] ? `<span class="fp">${C.esc(f[3])}</span>` : ""}</span>`).join("")}</div>`;
}
function wordCard(w, lang, withEx = true) {
  return `<div class="wcard">
    <div class="row" style="align-items:flex-start"><div><div class="wen">${C.esc(w.chunk)}</div>${w.pron ? `<div class="wpron">wymowa: ${C.esc(w.pron)}</div>` : ""}</div>${spk(w.chunk, lang)}</div>
    <div class="wpl">${C.esc(w.meaning)}</div>
    ${famHtml(w, lang)}
    ${withEx && (w.ex || w.context) ? `<div class="row" style="align-items:flex-start"><div style="flex:1"><div class="wex">${sentence(w, "full")}</div>${w.ex_pl ? `<div class="small muted">${C.esc(w.ex_pl)}</div>` : ""}</div>${spk(sentence(w, "plain"), lang)}</div>` : ""}
    ${w.tip ? `<div class="wtip">${C.esc(w.tip)}</div>` : ""}
  </div>`;
}

/* ---------- ekran języka ---------- */
export function renderLang() {
  const S = C.S, lang = S.langView, ul = S.langs[lang];
  if (!ul) return "";
  const L = learned(lang).length, D = due(lang).length, N = fresh(lang).length, U = solid(lang).length, T = all(lang).length;
  let next = "";
  if (L && !D) { const d = learned(lang).map(w => w.due).sort()[0]; const days = Math.round((new Date(d) - new Date(C.day(0))) / 864e5); next = days <= 1 ? "Następna powtórka jutro." : `Następna powtórka za ${days} dni.`; }
  return `<div class="screen bg-indigo">
    <div class="blob" style="width:260px;height:260px;background:var(--indigo-2);top:-110px;right:-90px"></div>
    <div class="row" style="position:relative"><button class="pillbtn" style="background:rgba(255,255,255,.14);color:#fff" data-act="tab" data-k="home">← Start</button><button class="pillbtn" style="background:var(--sun);color:var(--ink)" data-act="openGuide">Jak się uczyć?</button></div>
    <div style="display:flex;align-items:center;gap:14px;position:relative">${C.flag(lang, 52)}<div><h1 style="font-size:38px">${C.LANGS[lang].name}</h1><p class="soft">${C.band(ul.score)[0]} · ${C.pct(ul.score)}% drogi do ${C.nextBand(ul.score)}</p></div></div>

    <div class="bubble tilt-l" style="background:var(--sun);color:var(--ink);display:flex;flex-direction:column;gap:10px;position:relative">
      <h2 style="font-size:26px">Dzisiejsza lekcja</h2>
      <p>Powtórka, nowy materiał i mówienie, według metody trzech filarów.</p>
      <button class="go" data-act="start" data-k="${lang}">Zacznij lekcję ${C.I.arrow}</button>
      ${topicMap(lang, ul.score)}
    </div>

    <div class="bubble right tilt-r" style="background:#fff;color:var(--ink);display:flex;flex-direction:column;gap:12px;position:relative">
      <h2 style="font-size:26px">Powtórka słówek</h2>
      <div class="wstats"><div><b>${L}/${T}</b><span>poznane</span></div><div><b>${D}</b><span>do powtórki dziś</span></div><div><b>${U}</b><span>utrwalone</span></div></div>
      <div class="bar" aria-hidden="true" style="background:#E4EAFF"><i style="width:${T ? Math.round(L / T * 100) : 0}%;background:var(--blue)"></i></div>
      ${D ? `<button class="wbtn primary" data-act="wReview">Powtórz ${D} ${D === 1 ? "słówko" : "słówek"}<span class="sub">Słówka, których termin minął</span></button>` : ""}
      ${N ? `<button class="wbtn ${D ? "" : "primary"}" data-act="wLesson">Ucz się: ${Math.min(LESSON, N)} nowych słówek<span class="sub">Zostało ${N} nowych, około 6 minut</span></button>` : ""}
      ${L ? `<button class="wbtn" data-act="wTrain">Trening dowolny<span class="sub">10 losowych z poznanych, bez wpływu na terminy</span></button>` : ""}
      ${T ? `<button class="wbtn" data-act="wList">Lista wszystkich słówek</button>` : `<p class="small muted">Bank jest pusty. Dodaj słówka poniżej albo stukaj w zakreślone zwroty w lekcjach.</p>`}
      ${next ? `<p class="small muted">${next}</p>` : ""}
    </div>

    <div class="bubble tilt-l" style="background:var(--mint-soft);color:#0B3D25;display:flex;flex-direction:column;gap:10px;position:relative">
      <h2 style="font-size:26px">Dodaj słówka</h2>
      <p>Przeczytałeś coś nowego? Wpisz słówko albo zwrot, jedno w linii. Znaczenie możesz dopisać po myślniku.</p>
      <label class="f" style="color:#0B3D25">Słówka i zwroty<textarea class="field" id="newWords" placeholder="${lang === "de" ? "das Wochenende\nich möchte gern - chętnie bym" : "outgoing\nto look forward to - nie móc się doczekać"}" style="min-height:96px"></textarea></label>
      <label class="f" style="color:#0B3D25">Gdzie je spotkałeś? (opcjonalnie)<input class="field" type="text" id="newCtx" placeholder="wklej zdanie z książki lub artykułu"></label>
      <button class="go" data-act="wAdd">Dodaj do banku ${C.I.arrow}</button>
      ${S.wAdded?.length ? `<p class="small" style="font-weight:700">Dodane: ${S.wAdded.map(C.esc).join(", ")}. Czekają w „Ucz się: nowe słówka”.</p>` : ""}
    </div>

    <div class="bubble right tilt-r" style="background:var(--coral-soft);color:#4A1405;display:flex;flex-direction:column;gap:10px;position:relative">
      <h2 style="font-size:26px">Moja gramatyka</h2>
      ${(() => { const g = forLang(lang); if (!g.length) return `<p>Tu zbiorą się wzory z kroku „Jak to jest zbudowane” w lekcjach.</p>`;
        const cats = [...new Set(g.map(x => x.category))].map(c => CATS[c] || CATS.other);
        return `<p><b>${g.length}</b> ${g.length === 1 ? "wzór" : g.length < 5 ? "wzory" : "wzorów"}: ${C.esc(cats.join(", "))}.</p>`; })()}
      <button class="go" data-act="openGrammar">Otwórz ${C.I.arrow}</button>
    </div>
  </div>`;
}

/* ---------- sesja ćwiczeń ---------- */
function typesFor(lang) { return all(lang).length >= 4 ? ["mc", "gap", "prod", "sent"] : ["prod", "sent"]; }
async function startSession(kind) {
  const S = C.S, lang = S.langView;
  let items = [], title = "";
  if (kind === "lesson") { items = fresh(lang).slice(0, LESSON); title = "Lekcja słówek"; }
  if (kind === "review") { items = shuffle(due(lang)); title = "Powtórka"; }
  if (kind === "train") { items = shuffle(learned(lang)).slice(0, 10); title = "Trening"; }
  if (!items.length) return C.toast("Nie ma tu teraz żadnych słówek.");
  const ok = await C.withBusy("Przygotowuję karty słówek…", async () => { await enrich(lang, items); return true; });
  if (!ok) return;
  const T = typesFor(lang);
  let queue;
  if (kind === "lesson") queue = [].concat(...["mc", "gap", "prod"].filter(t => T.includes(t)).map(t => shuffle(items).map(w => ({ w, type: t }))));
  else if (kind === "review") queue = items.map(w => ({ w, type: w.strength >= 3 && w.strength % 2 === 1 ? "sent" : "prod" }));
  else queue = items.map(w => ({ w, type: T[Math.floor(Math.random() * T.length)] }));
  S.W = { kind, lang, title, items, intro: kind === "lesson" ? 0 : -1, queue, pos: 0, fb: null, reveal: false, tiles: null };
  S.view = "words"; C.render(); C.scrollTop();
}

function distract(w, lang) { return shuffle(all(lang).filter(x => x !== w)).slice(0, 3); }
function head(W) {
  const total = W.intro >= 0 ? W.items.length : W.queue.length, done = W.intro >= 0 ? W.intro : W.pos;
  return `<div class="row"><span class="sticker st-sun">${C.esc(W.title.toUpperCase())}</span><button class="pillbtn" style="background:rgba(255,255,255,.15);color:#fff" data-act="wQuit">✕ Wyjdź</button></div>
  <div class="bar" style="background:rgba(255,255,255,.22)" aria-hidden="true"><i style="width:${Math.round(done / Math.max(1, total) * 100)}%;background:#fff"></i></div>`;
}

export function renderWords() {
  const W = C.S.W, lang = W.lang;
  if (W.done) return `<div class="screen bg-blue"><div class="grow"></div><h1 style="font-size:46px">${C.esc(W.done.title)}</h1><p style="color:#D6E2FF">${C.esc(W.done.text)}</p><div class="grow"></div></div>
    <div class="footer bg-blue" style="display:flex;flex-direction:column;gap:10px">${W.kind === "lesson" && fresh(lang).length ? `<button class="btn btn-sun" data-act="wLesson">Następna lekcja słówek</button>` : ""}<button class="btn btn-white" style="color:var(--blue)" data-act="wBack">Wróć do języka</button></div>`;
  if (W.intro >= 0 && W.intro < W.items.length) {
    const w = W.items[W.intro];
    return `<div class="screen bg-blue">${head(W)}<p style="color:#D6E2FF">Nowe słówko ${W.intro + 1} z ${W.items.length}. Przeczytaj zdanie na głos.</p>${wordCard(w, lang)}</div>
      <div class="footer bg-blue twobtn">${W.intro > 0 ? `<button class="btn btn-ghost" style="color:#fff" data-act="wIntroBack">Wstecz</button>` : ""}<button class="btn btn-white" style="color:var(--blue)" data-act="wIntroNext">Dalej</button></div>`;
  }
  const q = W.queue[W.pos], w = q.w; let body = "";
  if (q.type === "mc") {
    W.opts = W.opts || shuffle([w, ...distract(w, lang)]);
    body = `<p class="small muted">Co to znaczy?</p><div class="row"><div class="wen">${C.esc(w.chunk)}</div>${spk(w.chunk, lang)}</div>
      <div class="opts">${W.opts.map((o, i) => `<button class="wbtn ${W.fb ? (o === w ? "ok" : W.pick === i ? "no" : "") : ""}" ${W.fb ? "disabled" : ""} data-act="wPick" data-k="${i}">${C.esc(o.meaning)}</button>`).join("")}</div>`;
  } else if (q.type === "gap") {
    W.opts = W.opts || shuffle([w, ...distract(w, lang)]);
    body = `<p class="small muted">Wybierz brakujące wyrażenie.</p><div class="wex">${sentence(w, "gap")}</div>${w.ex_pl ? `<div class="small muted">${C.esc(w.ex_pl)}</div>` : ""}
      <div class="opts">${W.opts.map((o, i) => `<button class="wbtn ${W.fb ? (o === w ? "ok" : W.pick === i ? "no" : "") : ""}" ${W.fb ? "disabled" : ""} data-act="wPick" data-k="${i}">${C.esc(answerOf(o))}</button>`).join("")}</div>`;
  } else if (q.type === "prod") {
    const words = norm(answerOf(w)).split(" ");
    const top = `<p class="small muted">Uzupełnij w języku: ${C.esc(C.LANGS[lang].name.toLowerCase())}.</p><div class="wpl">${C.esc(w.meaning)}</div><div class="wex">${sentence(w, "gap")}</div>${w.ex_pl ? `<div class="small muted">${C.esc(w.ex_pl)}</div>` : ""}`;
    if (words.length >= 3) {
      if (!W.tiles) { const pool = [...new Set(all(lang).filter(x => x !== w).flatMap(x => norm(answerOf(x)).split(" ")))].filter(x => !words.includes(x)); W.tiles = { pool: shuffle(words.concat(shuffle(pool).slice(0, 2))), ans: [] }; }
      body = top + `<div class="tiles ans" aria-label="Twoja odpowiedź">${W.tiles.ans.map((t, i) => `<button class="tile" ${W.fb ? "disabled" : ""} data-act="wTileBack" data-k="${i}">${C.esc(t)}</button>`).join("")}</div>
        <div class="tiles">${W.tiles.pool.map((t, i) => `<button class="tile" ${W.fb ? "disabled" : ""} data-act="wTile" data-k="${i}">${C.esc(t)}</button>`).join("")}</div>
        ${W.fb ? "" : `<button class="wbtn primary" data-act="wTilesCheck">Sprawdź</button>`}`;
    } else {
      body = top + (W.fb ? `<div class="field" style="border:2px solid var(--line)">${C.esc(W.given || "")}</div>` : `<div class="answer"><input class="field" type="text" id="wAns" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wpisz odpowiedź" style="border:2px solid var(--line)"><button class="mic" data-act="mic" data-k="wAns" aria-label="Odpowiedz głosem">${C.I.mic}</button></div>
        <button class="wbtn primary" data-act="wCheck">Sprawdź</button><button class="linkbtn" data-act="wHint">Pokaż pierwszą literę</button>`);
    }
  } else {
    body = `<p class="small muted">Powiedz to zdanie na głos w języku: ${C.esc(C.LANGS[lang].name.toLowerCase())}.</p><div class="wpl">${C.esc(w.ex_pl || w.meaning)}</div><p class="small muted">Szukane wyrażenie: ${C.esc(w.meaning)}</p>
      ${W.reveal ? `<div class="row" style="align-items:flex-start"><div class="wex" style="flex:1">${sentence(w, "full")}</div>${spk(sentence(w, "plain"), lang)}</div>
        <div class="opts"><button class="wbtn ok" data-act="wSelf" data-k="1">Umiałem</button><button class="wbtn no" data-act="wSelf" data-k="0">Jeszcze nie</button></div>` : `<button class="wbtn primary" data-act="wReveal">Pokaż odpowiedź</button>`}`;
  }
  const fb = W.fb ? `<div class="wfb ${W.fb.ok ? "ok" : "no"}"><b>${W.fb.ok ? "Dobrze!" : "Poprawna odpowiedź: " + C.esc(answerOf(w))}</b>
      <div class="row" style="align-items:flex-start"><div style="flex:1"><div class="wex">${sentence(w, "full")}</div><div class="small">${C.esc(w.chunk)} = ${C.esc(w.meaning)}</div></div>${spk(sentence(w, "plain"), lang)}</div>
      ${famHtml(w, lang)}${!W.fb.ok && w.tip ? `<div class="small">${C.esc(w.tip)}</div>` : ""}${!W.fb.ok ? `<div class="small">To słówko wróci za chwilę.</div>` : ""}</div>` : "";
  return `<div class="screen bg-blue">${head(W)}<div class="wcard">${body}${fb}</div></div>
    ${W.fb ? `<div class="footer bg-blue"><button class="btn btn-white" style="color:var(--blue)" data-act="wNext">Dalej</button></div>` : ""}`;
}

/* ---------- ocena i harmonogram ---------- */
function mark(ok) {
  const W = C.S.W, q = W.queue[W.pos];
  if (!q.retry && W.kind === "review") {
    const s = ok ? Math.min(5, (q.w.strength || 1) + 1) : 1;
    save(q.w, { strength: s, due: C.day(INT[s]) });
  }
  if (!ok && (q.tries || 0) < 2) W.queue.splice(Math.min(W.pos + 4, W.queue.length), 0, { w: q.w, type: q.type, retry: true, tries: (q.tries || 0) + 1 });
}
function answered(ok) {
  const W = C.S.W; mark(ok); W.fb = { ok };
  C.speak(sentence(W.queue[W.pos].w, "plain"), W.lang);
  C.render();
}
async function finish() {
  const S = C.S, W = S.W;
  if (W.kind === "lesson") {
    await Promise.all(W.items.map(w => save(w, { introduced: true, strength: 1, due: C.day(1) })));
    W.done = { title: "Lekcja ukończona", text: `Znasz ${learned(W.lang).length} z ${all(W.lang).length} słówek. Te z tej lekcji wrócą jutro do powtórki.` };
  } else if (W.kind === "review") W.done = { title: "Powtórka zrobiona", text: "Słówka z dobrą odpowiedzią wrócą po dłuższej przerwie, a te z błędem już jutro." };
  else W.done = { title: "Trening skończony", text: "Dobra robota. Terminy powtórek zostają bez zmian." };
  C.render(); C.scrollTop();
}

/* ---------- lista ---------- */
export function renderList() {
  const S = C.S, lang = S.langView, q = norm(S.wSearch || "");
  const items = all(lang).filter(w => !q || norm(w.chunk).includes(q) || norm(w.meaning).includes(q));
  return `<div class="screen bg-ground"><div class="row"><h2>Wszystkie słówka</h2><button class="chip" data-act="wBack">Wróć</button></div>
    <input class="field" type="search" id="wSearch" value="${C.esc(S.wSearch || "")}" placeholder="Szukaj po polsku lub w języku nauki" style="border:2px solid var(--line)">
    <div class="card">${items.map(w => `<div class="row"><div><b>${C.esc(w.chunk)}</b> · <span class="muted">${C.esc(w.meaning)}</span><br><span class="small muted">${w.introduced === false ? "nowe" : w.due <= C.day(0) ? "do powtórki dziś" : "powtórka " + C.esc(w.due)}</span></div>
      <div style="display:flex;gap:8px;align-items:center"><span class="strength">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= (w.introduced === false ? 0 : w.strength) ? "on" : ""}"></i>`).join("")}</span>${spk(w.chunk, lang)}</div></div>`).join('<div class="divider"></div>') || "<p>Nic nie znaleziono.</p>"}</div></div>`;
}

/* ---------- zdarzenia ---------- */
export async function act(a, k) {
  const S = C.S, W = S.W;
  switch (a) {
    case "openLang": S.langView = k; S.wAdded = null; S.view = "lang"; C.render(); C.scrollTop(); return true;
    case "wLesson": await startSession("lesson"); return true;
    case "wReview": await startSession("review"); return true;
    case "wTrain": await startSession("train"); return true;
    case "wList": S.wSearch = ""; S.view = "wlist"; C.render(); C.scrollTop(); return true;
    case "wBack": case "wQuit": S.W = null; S.view = "lang"; C.render(); C.scrollTop(); return true;
    case "wAdd": {
      const lang = S.langView, ctx = (document.querySelector("#newCtx")?.value || "").trim();
      const lines = (document.querySelector("#newWords")?.value || "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, 20);
      if (!lines.length) { C.toast("Wpisz co najmniej jedno słówko."); return true; }
      const items = lines.map(l => { const [c, ...m] = l.split(/\s+[-–—=]\s+/); return { chunk: c.trim(), meaning: m.join(" - ").trim(), context: ctx }; })
        .filter(x => x.chunk && !all(lang).some(b => norm(b.chunk) === norm(x.chunk)));
      if (!items.length) { C.toast("Te słówka są już w banku."); return true; }
      const added = await C.withBusy("Claude przygotowuje karty słówek…", async () => {
        const rows = [];
        for (const it of items) {
          const row = { user_id: C.uid(), lang, chunk: it.chunk, meaning: it.meaning, context: it.context, strength: 0, due: C.day(1), introduced: false };
          const { data, error } = await C.sb.from("bank").insert(row).select().single();
          if (error) throw new Error("Nie udało się zapisać słówka. Czy uruchomiłeś plik 002_bank_slowek.sql w Supabase?");
          S.bank.unshift(data); rows.push(data);
        }
        await enrich(lang, rows);
        return rows.map(r => r.chunk);
      });
      if (added) { S.wAdded = added; C.toast(`Dodano ${added.length} do banku.`); }
      return true;
    }
    case "wIntroBack": if (W.intro > 0) W.intro--; C.render(); C.scrollTop(); return true;
    case "wIntroNext": W.intro++; if (W.intro >= W.items.length) W.intro = -1; C.render(); C.scrollTop(); return true;
    case "wPick": { if (W.fb) return true; const o = W.opts[+k]; W.pick = +k; answered(o === W.queue[W.pos].w); return true; }
    case "wCheck": {
      const v = document.querySelector("#wAns")?.value || ""; if (!v.trim()) return true;
      W.given = v; const exp = norm(answerOf(W.queue[W.pos].w)), got = norm(v);
      answered(got === exp || (exp.length > 5 && lev(got, exp) <= 1)); return true;
    }
    case "wHint": { const el = document.querySelector("#wAns"); if (el && !el.value) { el.value = answerOf(W.queue[W.pos].w)[0]; el.focus(); } return true; }
    case "wTile": W.tiles.ans.push(W.tiles.pool.splice(+k, 1)[0]); C.render(); return true;
    case "wTileBack": W.tiles.pool.push(W.tiles.ans.splice(+k, 1)[0]); C.render(); return true;
    case "wTilesCheck": if (!W.tiles.ans.length) return true; answered(W.tiles.ans.join(" ") === norm(answerOf(W.queue[W.pos].w))); return true;
    case "wReveal": W.reveal = true; C.speak(sentence(W.queue[W.pos].w, "plain"), W.lang); C.render(); return true;
    case "wSelf": mark(k === "1"); W.fb = null; W.reveal = false; W.pos++; W.opts = null; W.tiles = null; W.given = null;
      if (W.pos >= W.queue.length) await finish(); else { C.render(); C.scrollTop(); } return true;
    case "wNext": W.fb = null; W.pos++; W.opts = null; W.tiles = null; W.pick = null; W.given = null;
      if (W.pos >= W.queue.length) await finish(); else { C.render(); C.scrollTop(); } return true;
  }
  return false;
}

export function afterRender() {
  const a = document.querySelector("#wAns");
  if (a) { a.focus({ preventScroll: true }); a.addEventListener("keydown", e => { if (e.key === "Enter") act("wCheck"); }); }
  const s = document.querySelector("#wSearch");
  if (s) s.addEventListener("input", () => { C.S.wSearch = s.value; const pos = s.selectionStart; C.render(); const n = document.querySelector("#wSearch"); n.focus(); n.setSelectionRange(pos, pos); });
}

// STAYSI: czas nauki (lekcje + filmy), kalendarz z podsumowaniami i prognoza poziomu.
let C = null; // wspólne narzędzia z app.js (init)
export function init(ctx) { C = ctx; }

/* ================= Dane: minuty dnia ================= */
const LEVEL_OF = s => (s < 43 ? "A" : s < 76 ? "B" : "C");
// Minuty lekcji, filmów i nowe słówka danego dnia (lang = null: wszystkie języki)
export function dayStats(lang, d) {
  const S = C.S, m = x => !lang || x.lang === lang;
  const ls = (S.done || []).filter(x => m(x) && x.d === d);
  const vs = (S.activity || []).filter(x => m(x) && x.day === d);
  return {
    lesson: ls.reduce((a, x) => a + (x.minutes || 0), 0), lessons: ls.length,
    video: vs.reduce((a, x) => a + (x.minutes || 0), 0), videos: vs,
    words: (S.bank || []).filter(b => m(b) && b.created_at && new Date(b.created_at).toLocaleDateString("sv-SE") === d).length
  };
}
const total = st => st.lesson + st.video;

/* ================= Filmy: porady i kanały dla poziomu ================= */
// Kanały polecane w zestawieniach dla uczących się (Lingoda, FluentU, UBC i inne); link prowadzi do wyszukiwarki YouTube
export const VIDEOS = {
  de: { A: ["Nicos Weg (DW)", "Learn German with Anja", "Easy German"], B: ["Easy German", "Jojo sucht das Glück (DW)", "Deutsch mit Marija"], C: ["Galileo", "ARTEde", "DW Deutsch"] },
  es: { A: ["Dreaming Spanish (Superbeginner, Beginner)", "Butterfly Spanish"], B: ["Dreaming Spanish (Intermediate)", "Easy Spanish", "Why Not Spanish?"], C: ["Dreaming Spanish (Advanced)", "Easy Spanish", "RTVE Noticias"] },
  fr: { A: ["Learn French with Alexa", "Learn French With Vincent"], B: ["Easy French", "Français Authentique"], C: ["Français Authentique", "HugoDécrypte", "ARTE"] },
  it: { A: ["Italy Made Easy", "LearnAmo"], B: ["Easy Italian", "Italiano Automatico", "LearnAmo"], C: ["Podcast Italiano", "Easy Italian", "Rai News"] },
  en: { A: ["BBC Learning English", "English with Lucy"], B: ["Easy English", "BBC Learning English: 6 Minute English"], C: ["TED", "Kurzgesagt", "BBC News"] },
  pl: { A: ["Easy Polish", "Polish with John"], B: ["Easy Polish", "Real Polish"], C: ["Easy Polish", "TVP Info"] }
};
// Ile minut filmu i jak oglądać, żeby to była nauka, a nie tło
export const HOW = {
  A: { min: 15, tips: ["Krótkie odcinki, 5–10 minut. Ten sam film obejrzyj dwa razy.", "Napisy w języku nauki. Na sam początek możesz włączyć polskie, potem przełącz.", "Zatrzymuj po zdaniu i powtarzaj je na głos, naśladując wymowę.", "Zapisz 2–3 zwroty do banku słówek."] },
  B: { min: 20, tips: ["Wybierz film, z którego rozumiesz 70–90%. Za trudny męczy, za łatwy nie uczy.", "Napisy w języku nauki, nie po polsku.", "Trudny fragment cofnij i obejrzyj jeszcze raz, powtórz zdanie na głos.", "Na koniec streść film na głos w 2–3 zdaniach i zapisz 3 zwroty do banku."] },
  C: { min: 25, tips: ["Oglądaj bez napisów, a trudny fragment drugi raz z napisami w języku nauki.", "Wybieraj prawdziwe treści: wywiady, reportaże, seriale.", "Notuj idiomy i potoczne zwroty, nie pojedyncze słowa.", "Po filmie powiedz na głos, co myślisz o temacie: minuta mówienia."] }
};
const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
export function videoHelp(lang, score, open = false) {
  const lvl = LEVEL_OF(score), h = HOW[lvl], ch = VIDEOS[lang]?.[lvl] || [];
  return `<details class="more vhelp" ${open ? "open" : ""}><summary>Jak oglądać i co (poziom ${C.band(score)[0]})</summary>
    <p class="small muted">Najlepiej ok. ${h.min} minut dziennie.</p>
    <ul class="tips">${h.tips.map(t => `<li>${C.esc(t)}</li>`).join("")}</ul>
    ${ch.length ? `<p class="flabel">Kanały na ten poziom</p><div class="chlinks">${ch.map(c => `<a class="chip" href="${yt(c)}" target="_blank" rel="noopener">${C.esc(c)}</a>`).join("")}</div>` : ""}
  </details>`;
}

/* ================= Dzień w kafelku języka ================= */
export function todayBox(lang) {
  const st = dayStats(lang, C.day(0)), titles = st.videos.map(v => v.title).filter(Boolean);
  return `<div class="today">
    <div class="trow"><span>Lekcja</span><b>${st.lessons ? `${st.lesson} min, zrobiona` : "jeszcze nie"}</b></div>
    <div class="trow"><span>Film</span><b>${st.video ? `${st.video} min${titles.length ? ` · ${C.esc(titles.join(", "))}` : ""}` : "jeszcze nie"}</b><button class="linkbtn" data-act="vidOpen" data-k="${lang}">${st.video ? "Dodaj kolejny" : "Dodaj film"}</button></div>
  </div>`;
}

/* ================= Arkusz: dodaj film ================= */
const MINS = [5, 10, 15, 20, 30, 45, 60];
export function renderVideoSheet() {
  const S = C.S, v = S.vid, ul = S.langs[v.lang], today = dayStats(v.lang, C.day(0));
  return `<div class="overlay" data-act="vidClose"><div class="sheet" role="dialog" aria-label="Dodaj film"><div class="grab"></div>
    <h2>Film po ${C.LANGS[v.lang].name.toLowerCase().replace(/ki$/, "ku").replace(/ski$/, "sku")}</h2>
    <p class="flabel">Ile minut?</p>
    <div class="mins">${MINS.map(m => `<button class="chip ${v.min === m ? "sel" : ""}" data-act="vidMin" data-k="${m}" aria-pressed="${v.min === m}">${m}</button>`).join("")}</div>
    <label class="f">Inna liczba minut<input class="field" type="number" inputmode="numeric" min="1" max="600" id="vidMin" value="${MINS.includes(v.min) ? "" : (v.min || "")}" placeholder="np. 25"></label>
    <label class="f">Co oglądałeś? (opcjonalnie)<input class="field" type="text" id="vidTitle" maxlength="80" value="${C.esc(v.title || "")}" placeholder="np. Easy German, odcinek o pracy"></label>
    <p class="flabel">Kiedy?</p>
    <div class="mins">${[["0", "Dziś"], ["-1", "Wczoraj"]].map(([k, l]) => `<button class="chip ${String(v.off || 0) === k ? "sel" : ""}" data-act="vidDay" data-k="${k}">${l}</button>`).join("")}</div>
    <button class="btn btn-sun" data-act="vidSave">Zapisz film</button>
    ${today.videos.length ? `<div class="vlist"><p class="flabel">Dziś zapisane</p>${today.videos.map(x => `<div class="row small"><span>${x.minutes} min${x.title ? " · " + C.esc(x.title) : ""}</span><button class="linkbtn" data-act="vidDel" data-k="${x.id}">Usuń</button></div>`).join("")}</div>` : ""}
    ${videoHelp(v.lang, ul?.score || 30)}
    <button class="btn btn-ghost" data-act="vidClose">Anuluj</button></div></div>`;
}
// to, co już wpisane w arkuszu, nie znika po stuknięciu przycisku
function keep() { const v = C.S.vid, own = parseInt(C.$("#vidMin")?.value || "", 10); v.title = C.$("#vidTitle")?.value ?? v.title; if (own > 0) v.min = own; }
let noActivity = false; // baza bez tabeli activity (nie uruchomiono 007_postep_i_filmy.sql)
export async function act(a, k) {
  const S = C.S;
  switch (a) {
    case "vidOpen": S.vid = { lang: k || S.langView, min: null, off: 0, title: "" }; C.render(); return true;
    case "vidClose": S.vid = null; C.render(); return true;
    case "vidMin": keep(); S.vid.min = +k; C.render(); return true;
    case "vidDay": keep(); S.vid.off = +k; C.render(); return true;
    case "vidSave": {
      const own = parseInt(C.$("#vidMin")?.value || "", 10), min = own > 0 ? own : S.vid.min, title = (C.$("#vidTitle")?.value || "").trim().slice(0, 80);
      if (!min || min < 1 || min > 600) { C.toast("Wybierz, ile minut oglądałeś."); return true; }
      if (noActivity) { C.toast("Najpierw uruchom w Supabase plik 007_postep_i_filmy.sql."); return true; }
      const row = { user_id: C.uid(), lang: S.vid.lang, day: C.day(S.vid.off || 0), kind: "video", minutes: min, title };
      const { data, error } = await C.sb.from("activity").insert(row).select().single();
      if (error) { if (/activity/.test(error.message || "")) noActivity = true; C.toast(noActivity ? "Najpierw uruchom w Supabase plik 007_postep_i_filmy.sql." : "Nie udało się zapisać filmu."); return true; }
      (S.activity = S.activity || []).unshift(data || { ...row, id: Date.now() });
      S.vid = null; C.toast(`Zapisano ${min} min filmu.`); C.render(); return true;
    }
    case "vidDel": {
      const id = +k; await C.sb.from("activity").delete().eq("id", id);
      S.activity = (S.activity || []).filter(x => x.id !== id); C.render(); return true;
    }
    case "calLang": S.calLang = k || null; S.calDay = null; C.render(); return true;
    case "calRange": S.calRange = k; C.render(); return true;
    case "calDay": S.calDay = S.calDay === k ? null : k; C.render(); return true;
  }
  return false;
}

/* ================= Po lekcji: czas na film ================= */
export function afterLesson(lang) {
  const st = dayStats(lang, C.day(0)), ul = C.S.langs[lang];
  if (st.video) return `<section class="sec"><h2>Film na dziś</h2><p>Masz już ${st.video} min filmu. Świetnie, to dobre uzupełnienie lekcji.</p><button class="linkbtn" data-act="vidOpen" data-k="${lang}">Dodaj kolejny film</button></section>`;
  const h = HOW[LEVEL_OF(ul?.score || 30)];
  return `<section class="sec"><h2>Teraz albo wieczorem: film</h2>
    <p>Lekcja zrobiona. Jeśli dziś jeszcze nie oglądałeś, obejrzyj ok. ${h.min} minut filmu na swoim poziomie. Uszy uczą się z prawdziwej mowy, a zwroty z lekcji wrócą w innym kontekście.</p>
    ${videoHelp(lang, ul?.score || 30, true)}
    <button class="btn btn-ghost" data-act="vidOpen" data-k="${lang}">Obejrzałem, dodaj minuty</button>
  </section>`;
}

/* ================= Prognoza ================= */
// Godziny nauki na 1 punkt GSE (z tabel Cambridge i Goethe-Institut: ok. 95 h na A1→A2, 185 h na A2→B1, 175 h na B1→B2, 200 h na B2→C1, 350 h na C1→C2)
const HPP = [[29, 12], [42, 14], [58, 11], [75, 12], [90, 39]];
const hoursAt = p => (HPP.find(([to]) => p <= to) || HPP[HPP.length - 1])[1];
const NEXT = [30, 43, 59, 76, 85]; // początek A2, B1, B2, C1, C2
const BIG = { 30: "A2", 43: "B1", 59: "B2", 76: "C1", 85: "C2" };
export const VIDEO_WEIGHT = 0.5; // minuta filmu liczy się jak pół minuty lekcji (to słuchanie, bez mówienia)
// Twoje tempo: ile razy szybciej (albo wolniej) niż w tabeli, gdy jest już z czego to policzyć
export function paceFactor(lang) {
  const S = C.S, ls = (S.done || []).filter(x => x.lang === lang && Number.isFinite(x.score)).sort((a, b) => a.at - b.at);
  if (ls.length < 10) return null;
  const from = ls[0].score, to = ls[ls.length - 1].score; if (to <= from) return null;
  let tableH = 0; for (let p = from; p < to; p++) tableH += hoursAt(p);
  const since = ls[0].d;
  const lessonH = ls.reduce((a, x) => a + x.minutes, 0) / 60;
  const videoH = (S.activity || []).filter(x => x.lang === lang && x.day >= since).reduce((a, x) => a + x.minutes, 0) / 60 * VIDEO_WEIGHT;
  const real = lessonH + videoH; if (real < 3) return null;
  return Math.max(0.5, Math.min(2.5, tableH / real));
}
export function forecast(lang, minPerDay, videoPerDay = 0) {
  const ul = C.S.langs[lang]; if (!ul) return null;
  const s = ul.score, target = NEXT.find(n => n > s); if (!target) return null;
  let h = 0; for (let p = s; p < target; p++) h += hoursAt(p);
  const f = paceFactor(lang) || 1;
  const perDay = (minPerDay + videoPerDay * VIDEO_WEIGHT) / 60 * f;
  const days = Math.ceil(h / perDay), d = new Date(); d.setDate(d.getDate() + days);
  return { level: BIG[target], days, hours: Math.round(h), date: d, personal: f !== 1,
    label: d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }) };
}
const months = days => days < 45 ? `${Math.round(days / 7)} tyg.` : `${Math.round(days / 30)} mies.`;
// Opis pod kafelkami czasu: ile daje dodatkowy film
export function forecastNote(lang, minPerDay) {
  const ul = C.S.langs[lang]; if (!ul) return "";
  const base = forecast(lang, minPerDay), h = HOW[LEVEL_OF(ul.score)], plus = forecast(lang, minPerDay, h.min);
  if (!base) return `<p class="small muted">Jesteś na najwyższym poziomie. Teraz chodzi o utrzymanie i szlifowanie.</p>`;
  const gain = base.days - plus.days;
  return `<div class="fnote"><p class="small">Przy ${minPerDay} min dziennie <b>${base.level}</b> ok. <b>${base.label}</b> (zostało ok. ${base.hours} godz. nauki${base.personal ? ", liczone z Twojego tempa" : ""}).</p>
    <p class="small muted">Dodaj ${h.min} min filmu na swoim poziomie dziennie, a ${base.level} będzie ok. ${months(gain)} wcześniej (${plus.label}).</p></div>`;
}
export const forecastShort = (lang, m) => { const f = forecast(lang, m); return f ? `${f.level} ≈ ${f.date.toLocaleDateString("pl-PL", { month: "short", year: "numeric" })}` : ""; };

/* ================= Kalendarz ================= */
const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE"); };
const heat = m => (m <= 0 ? 0 : m < 15 ? 1 : m < 30 ? 2 : m < 45 ? 3 : 4);
function rangeSum(lang, days) {
  let lesson = 0, video = 0, lessons = 0, words = 0, active = 0;
  for (let i = 0; i < days; i++) { const st = dayStats(lang, C.day(-i)); lesson += st.lesson; video += st.video; lessons += st.lessons; words += st.words; if (total(st)) active++; }
  return { lesson, video, lessons, words, active, days };
}
const hm = m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim() : `${m} min`;
function streakFor(lang) { let n = 0, i = total(dayStats(lang, C.day(0))) ? 0 : -1; while (total(dayStats(lang, C.day(i))) && n < 1000) { n++; i--; } return n; }
export function renderCalendar() {
  const S = C.S, langs = Object.keys(S.langs), lang = S.calLang && S.langs[S.calLang] ? S.calLang : null, range = S.calRange || "week";
  const today = C.day(0), dow = (new Date().getDay() + 6) % 7, start = shift(today, -dow - 7 * 5); // 6 tygodni, od poniedziałku
  const cells = Array.from({ length: 7 * 6 }, (_, i) => shift(start, i));
  const R = { week: [7, "7 dni"], month: [30, "30 dni"], year: [365, "rok"] }[range], sum = rangeSum(lang, R[0]);
  const sel = S.calDay, sst = sel ? dayStats(lang, sel) : null;
  const ul = lang ? S.langs[lang] : null;
  return `<div><h1>Kalendarz</h1><p class="muted">Lekcje, filmy i słówka dzień po dniu</p></div>
  <div class="segs" role="tablist">${[[null, "Wszystkie"], ...langs.map(k => [k, C.LANGS[k].name])].map(([k, l]) => `<button class="chip ${lang === k ? "sel" : ""}" data-act="calLang" data-k="${k || ""}" aria-pressed="${lang === k}">${l}</button>`).join("")}</div>
  <section class="sec"><div class="row"><h2>Ostatnie tygodnie</h2><span class="small muted">seria: ${streakFor(lang)} ${streakFor(lang) === 1 ? "dzień" : "dni"}</span></div>
    <div class="cal" aria-label="Kalendarz nauki">${DOW.map(d => `<span class="cdow">${d}</span>`).join("")}
      ${cells.map(d => { const st = dayStats(lang, d), m = total(st), fut = d > today; return `<button class="cday h${fut ? "x" : heat(m)} ${d === today ? "now" : ""} ${d === sel ? "sel" : ""}" ${fut ? "disabled" : `data-act="calDay" data-k="${d}"`} aria-label="${d}: ${m} min">${+d.slice(8)}</button>`; }).join("")}
    </div>
    <div class="clegend small muted"><span>mniej</span>${[0, 1, 2, 3, 4].map(h => `<i class="cday h${h}"></i>`).join("")}<span>więcej (45+ min)</span></div>
    ${sst ? `<div class="cdet"><b>${new Date(sel + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</b>
      <div class="trow"><span>Lekcje</span><b>${sst.lessons ? `${sst.lessons} · ${sst.lesson} min` : "–"}</b></div>
      <div class="trow"><span>Filmy</span><b>${sst.video ? hm(sst.video) : "–"}</b></div>
      ${sst.videos.filter(v => v.title).map(v => `<p class="small muted">${C.esc(v.title)}</p>`).join("")}
      <div class="trow"><span>Nowe słówka</span><b>${sst.words || "–"}</b></div></div>` : `<p class="small muted">Stuknij dzień, żeby zobaczyć szczegóły.</p>`}
  </section>
  <section class="sec"><div class="row"><h2>Podsumowanie</h2></div>
    <div class="segs">${[["week", "Tydzień"], ["month", "Miesiąc"], ["year", "Rok"]].map(([k, l]) => `<button class="chip ${range === k ? "sel" : ""}" data-act="calRange" data-k="${k}">${l}</button>`).join("")}</div>
    <div class="big-num">${hm(sum.lesson + sum.video)}</div><p class="small muted">łącznie w ciągu: ${R[1]}${lang ? "" : ", wszystkie języki"}</p>
    <div class="wstats"><div><b>${hm(sum.lesson)}</b><span>${sum.lessons} ${sum.lessons === 1 ? "lekcja" : sum.lessons < 5 && sum.lessons > 1 ? "lekcje" : "lekcji"}</span></div><div><b>${hm(sum.video)}</b><span>filmy</span></div><div><b>${sum.words}</b><span>nowe słówka</span></div></div>
    <p class="small">${sum.active} z ${R[0]} dni z nauką · średnio ${Math.round((sum.lesson + sum.video) / R[0])} min dziennie</p>
    ${ul ? `<p class="small muted">${C.LANGS[lang].name}: teraz ${C.band(ul.score)[0]}, ${ul.score} pkt.</p>${forecastNote(lang, Math.max(10, Math.round(sum.lesson / R[0]) || 15))}` : ""}
  </section>
  ${lang ? "" : `<section class="sec"><h2>Według języka (${R[1]})</h2>${langs.map(k => { const s = rangeSum(k, R[0]); return `<div class="trow"><span>${C.LANGS[k].name}</span><b>${hm(s.lesson + s.video)}</b></div>`; }).join("")}</section>`}`;
}

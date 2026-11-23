// STAYSI: "Moja gramatyka" i przewodnik "Jak się uczyć?".
let C = null; // wspólne narzędzia z app.js (init)
export function init(ctx) { C = ctx; }

export const TOPICS = { work: "praca", travel: "podróże", food: "jedzenie", health: "zdrowie", home: "dom i rodzina", shopping: "zakupy", errands: "urzędy i sprawy", hobbies: "hobby i sport", tech: "technologia", culture: "kultura i media", relationships: "uczucia i relacje", education: "nauka", nature: "przyroda", society: "społeczeństwo" };

// Ocena poziomu z kilku lekcji: mediana z ostatnich 5 ocen mówienia
export const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2); };
export function nextScore(ul, recent) {
  // recent: ostatnie oceny tego języka, najnowsza pierwsza: [{estimate, topic}]
  const last = recent.slice(0, 5), est = last.map(r => r.estimate), score = ul.score;
  if (!est.length) return { score, why: "" };
  const med = median(est), topics = new Set(last.map(r => r.topic).filter(Boolean)).size;
  // Kalibracja (lekcje 1-5): wynik to bieżąca średnia z testu i wszystkich ocen mówienia.
  // Po n-tej lekcji nowa ocena waży 1/(n+1): na początku szybko poprawia błąd testu, potem coraz mniej skacze.
  // Pojedyncza ocena liczy się najwyżej jako 12 pkt od obecnego wyniku (odporność na jedną dziwną ocenę).
  if ((ul.lessons_done || 0) < 5) {
    const n = (ul.lessons_done || 0) + 1, e = Math.max(score - 12, Math.min(score + 12, est[0]));
    return { score: Math.max(22, Math.min(90, score + Math.round((e - score) / (n + 1)))), why: "calibration" };
  }
  if (est.length < 3 || topics < 2) return { score, why: "need-more" };
  if (med > score) return { score: Math.min(90, score + (med >= score + 8 ? 2 : 1)), why: "up" };
  return { score, why: "hold" };
}

export function topicMap(lang, score) {
  const rated = (C.S.rated || []).filter(r => r.lang === lang && r.topic);
  if (rated.length < 3) return `<p class="small">Mapa Twoich tematów pojawi się po 3 lekcjach. Teraz: ${rated.length} z 3.</p>`;
  const by = {}; rated.forEach(r => (by[r.topic] = by[r.topic] || []).push(r.estimate));
  const avg = Object.entries(by).map(([t, v]) => [t, v.reduce((a, b) => a + b, 0) / v.length]);
  const strong = avg.filter(([, a]) => a >= score).map(([t]) => TOPICS[t] || t);
  const weak = avg.filter(([, a]) => a < score - 3).map(([t]) => TOPICS[t] || t);
  const unseen = Object.keys(TOPICS).filter(t => !by[t]).length;
  const row = (label, list) => list.length ? `<p class="small"><b>${label}:</b> ${C.esc(list.join(", "))}</p>` : "";
  return `<div class="tmap"><p class="small" style="font-weight:800">Twoje tematy</p>${row("Mocne", strong)}${row("Do podciągnięcia", weak)}<p class="small">Jeszcze nie było: ${unseen} z ${Object.keys(TOPICS).length} tematów.</p></div>`;
}

export const CATS = { word_order: "Kolejność słów", verbs: "Czasowniki", nouns: "Rzeczowniki i rodzajniki", adjectives: "Przymiotniki", prepositions: "Przyimki", pronouns: "Zaimki", other: "Inne" };
const key = t => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
const spk = (text, lang) => `<button class="spk" data-act="say" data-k="${C.esc(text)}" data-l="${lang}" aria-label="Odsłuchaj">${C.I.speaker}</button>`;
const back = (label = "Wróć") => `<button class="pillbtn backbtn" data-act="toLang">← ${label}</button>`;
export const forLang = lang => (C.S.grammar || []).filter(g => g.lang === lang);

/* ---------- zapis wzorów z lekcji ---------- */
let warned = false;
export async function saveFromLesson(L) {
  const S = C.S, list = (L.C.grammar || []).filter(g => g && g.title);
  for (const g of list) {
    const ex = [];
    if (g.example) ex.push({ t: g.example, tr: g.example_tr || "", src: L.C.title || "" });
    if (g.extra) ex.push({ t: g.extra, tr: g.extra_tr || "", src: "" });
    const old = forLang(L.lang).find(x => key(x.title) === key(g.title));
    if (old) {
      const examples = [...ex.filter(e => !old.examples.some(o => o.t === e.t)), ...(old.examples || [])].slice(0, 6);
      const fields = { examples, seen: (old.seen || 1) + 1, updated_at: new Date().toISOString() };
      if (g.rule && g.rule.length > (old.rule || "").length) fields.rule = g.rule;
      Object.assign(old, fields);
      await C.sb.from("grammar").update(fields).eq("id", old.id);
    } else {
      const row = { user_id: C.uid(), lang: L.lang, title: g.title.slice(0, 80), category: CATS[g.category] ? g.category : "other", rule: g.rule || "", examples: ex, seen: 1 };
      const { data, error } = await C.sb.from("grammar").insert(row).select().single();
      if (error) { if (!warned) { warned = true; C.toast("Nie zapisano gramatyki. Uruchom plik 003_gramatyka.sql w Supabase."); } return; }
      (S.grammar = S.grammar || []).unshift(data || row);
    }
  }
}

/* ---------- karta w lekcji ---------- */
const PO = { de: "po niemiecku", en: "po angielsku", es: "po hiszpańsku", fr: "po francusku", it: "po włosku", pl: "po polsku" };
export function lessonCard(L) {
  const list = L.C.grammar || [], con = (L.C.contrasts || []).filter(c => c && c.target && c.why);
  const po = PO[L.lang] || "w tym języku";
  return `<span class="sticker st-sun">Jak to jest zbudowane</span>
    ${con.length ? `<div><h2 style="font-size:32px">My mówimy tak, a ${po}…</h2><p style="color:var(--mu)">Zdania z dzisiejszego tekstu, w których ${po} mówi się inaczej niż po polsku. I dlaczego.</p></div>
    ${con.map(c => `<div class="gcard">
      <div class="cmp"><span class="cl">My mówimy</span><p>${C.esc(c.pl || "")}</p></div>
      <div class="cmp tgt"><span class="cl">${C.esc(po[0].toUpperCase() + po.slice(1))}</span><div class="row" style="align-items:flex-start"><b>${C.esc(c.target)}</b>${spk(c.target, L.lang)}</div>${c.literal ? `<span class="small muted">dosłownie: ${C.esc(c.literal)}</span>` : ""}</div>
      <p class="why"><b>Dlaczego?</b> ${C.esc(c.why)}</p>
    </div>`).join("")}` : ""}
    ${list.length ? `<div><h2 style="font-size:${con.length ? 26 : 32}px">${con.length ? "Wzory z tekstu" : "Zauważ w tekście"}</h2><p style="color:var(--mu)">${list.length === 1 ? "Wzór z dzisiejszego tekstu. Poszukaj go" : "Wzory z dzisiejszego tekstu. Poszukaj ich"} w zdaniach, które przed chwilą czytałeś.</p></div>
    ${list.map((g, i) => `<div class="gcard">
      <span class="gcat">${C.esc(CATS[g.category] || CATS.other)}</span>
      <h3>${i + 1}. ${C.esc(g.title)}</h3>
      <p>${C.esc(g.rule)}</p>
      ${g.example ? `<div class="gex"><div><b>${C.esc(g.example)}</b><span>${C.esc(g.example_tr || "")}</span></div>${spk(g.example, L.lang)}</div>` : ""}
      ${g.extra ? `<div class="gex"><div>${C.esc(g.extra)}<span>${C.esc(g.extra_tr || "")}</span></div>${spk(g.extra, L.lang)}</div>` : ""}
    </div>`).join("")}
    <p class="small" style="color:var(--mu)">Wzory zapisują się w „Mojej gramatyce” na ekranie języka.</p>` : ""}`;
}

/* ---------- Moja gramatyka ---------- */
export function renderGrammar() {
  const S = C.S, lang = S.langView, all = forLang(lang);
  const groups = Object.keys(CATS).map(k => [k, all.filter(g => g.category === k)]).filter(([, l]) => l.length);
  const open = S.gOpen || {};
  return `<div class="screen bg-ground">${back(C.LANGS[lang].name)}
    <div><h1 style="font-size:36px">Moja gramatyka</h1><p class="muted">${C.LANGS[lang].name} · ${all.length} ${all.length === 1 ? "wzór" : all.length < 5 && all.length > 1 ? "wzory" : "wzorów"} z Twoich lekcji</p></div>
    ${all.length ? "" : `<div class="card"><p>Na razie pusto. Po każdej lekcji, w kroku „Jak to jest zbudowane”, trafią tu 2–3 wzory z tekstu, który czytałeś.</p></div>`}
    ${groups.map(([k, l]) => `<h3 style="margin-top:6px">${C.esc(CATS[k])}</h3>
      ${l.map(g => `<div class="card gitem">
        <button class="grow-btn" data-act="gToggle" data-k="${g.id}" aria-expanded="${open[g.id] ? "true" : "false"}"><b>${C.esc(g.title)}</b><span class="seen">${g.seen > 1 ? `spotkane ${g.seen} razy` : "nowe"}</span></button>
        ${open[g.id] ? `<p>${C.esc(g.rule)}</p>${(g.examples || []).map(e => `<div class="gex light"><div>${C.esc(e.t)}<span>${C.esc(e.tr)}${e.src ? ` · z lekcji „${C.esc(e.src)}”` : ""}</span></div>${spk(e.t, lang)}</div>`).join("")}` : ""}
      </div>`).join("")}`).join("")}
  </div>`;
}

/* ---------- przewodnik ---------- */
export function renderGuide() {
  const S = C.S, lang = S.langView, ul = S.langs[lang], md = ul.score < 43 ? "A" : ul.score < 76 ? "B" : "C";
  const steps = md === "C"
    ? [["Powtórka", "Najpierw przejrzyj Skarbiec, potem uzupełniaj karty. Odpowiadaj z pamięci, zanim zajrzysz do odpowiedzi."],
       ["Czytanie", "Czytasz od razu oryginał. Tłumaczenie akapitu (PL) otwieraj dopiero, gdy naprawdę utkniesz. Stukaj zakreślone słowa, trafiają do banku."],
       ["Słuchanie", "Odtwórz całość i śledź tekst wzrokiem. Potem spróbuj posłuchać bez patrzenia."]]
    : [["Powtórka", "Posłuchaj poprzedniej lekcji, potem uzupełniaj karty. Odpowiadaj z pamięci, zanim zajrzysz do odpowiedzi."],
       ["Tłumaczenie", "Przeczytaj spokojnie po polsku, żeby wiedzieć, o czym jest tekst. Wtedy w oryginale skupisz się na tym, jak to powiedziano."],
       ["Oryginał", "Czytaj na głos, zdanie po zdaniu. Stukaj zakreślone zwroty: usłyszysz je, zobaczysz, jak są zbudowane, i trafią do banku."],
       ["Słuchanie", "Odtwórz całość i śledź tekst. Potem posłuchaj jeszcze raz i powtarzaj na głos za lektorem."]];
  steps.push(["Jak to jest zbudowane", "2–3 wzory z tekstu. Przeczytaj zasadę i znajdź ją w dialogu. Nie ucz się jej na pamięć, wróci w kolejnych lekcjach."],
    ["Barometr", "Powiedz szczerze, czy było za łatwo, w sam raz czy za trudno. Od tego zależy trudność następnej lekcji."],
    ["Mówienie", md === "A" ? "Ułóż własne zdanie o sobie z podanych zwrotów. Powiedz je na głos albo podyktuj."
      : md === "B" ? "Mów ok. 2 minuty na osobisty temat albo napisz 4–6 zdań. Używaj nowych zwrotów."
      : "Streść tekst i oceń go w 3 rundach: 3, 2 i 1 minuta. Za każdym razem zostaw tylko to, co najważniejsze.",
    ]);
  const sec = (title, body) => `<div class="card"><h3>${title}</h3>${body}</div>`;
  return `<div class="screen bg-ground">${back(C.LANGS[lang].name)}
    <div><h1 style="font-size:36px">Jak się uczyć?</h1><p class="muted">Krótki przewodnik po STAYSI. Wracaj tu, kiedy chcesz.</p></div>
    ${sec("Codzienny rytm, ok. 20 minut", `<ol class="glist"><li><b>Powtórz słówka</b>, które czekają na dziś (ok. 5 minut).</li><li><b>Zrób dzisiejszą lekcję</b> w wybranym czasie.</li><li><b>W ciągu dnia</b> dopisuj do banku słówka, które gdzieś przeczytasz lub usłyszysz.</li></ol>
      <p class="small muted">Lepiej 15 minut codziennie niż godzina raz w tygodniu. Pamięć lubi regularność.</p>`, "#FFF6D9")}
    ${sec(`Jak przejść lekcję dobrze <span class="gcat">tryb ${md}</span>`, `<ol class="glist">${steps.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join("")}</ol>
      <p class="small muted">Na starcie wybierasz, o czym ma być tekst: Claude wymyśla temat sam, albo podajesz swój temat, link do artykułu lub własny tekst. Czas (10, 15, 30, 45 minut) ustala długość lekcji, a nie stoper. Możesz robić ją we własnym tempie i w każdej chwili wyjść przyciskiem ✕.</p>`)}
    ${sec("Bank słówek", `<ul class="glist"><li><b>Dodawanie:</b> wpisz słówko lub zwrot, jedno w linii. Znaczenie możesz dopisać po myślniku. Claude zrobi kartę z wymową, zdaniem na Twoim poziomie i formami nieregularnymi.</li>
      <li><b>Ucz się nowych:</b> najpierw przeglądasz karty, potem ćwiczysz: wybór znaczenia, luka w zdaniu, wpisywanie.</li>
      <li><b>Powtórka:</b> słówko wraca po 1, 3, 7, 14 i 30 dniach. Dobra odpowiedź wydłuża przerwę, błąd skraca ją do jutra.</li>
      <li><b>Trening dowolny:</b> 10 losowych słówek bez wpływu na terminy. Dobry na chwilę w kolejce.</li></ul>`)}
    ${sec("Moja gramatyka", `<p>Zbiera wzory z kroku „Jak to jest zbudowane”, pogrupowane w działy. Gdy wzór wraca w kolejnej lekcji, dostaje nowy przykład i licznik „spotkane N razy”. Zaglądaj tu, gdy coś Ci umyka, ale nie wkuwaj: wzory same wracają w tekstach.</p>`)}
    ${sec("Poziom i tryby", `<p>Twój wynik to ${ul.score} na skali 10–90. Od niego zależy tryb lekcji:</p><ul class="glist"><li><b>A (A1–A2+):</b> dialogi z Twojego życia, tłumaczenie przed oryginałem, jedno zdanie do ułożenia.</li><li><b>B (B1–B2+):</b> rozmowy jak w podcaście, ok. 2 minuty mówienia.</li><li><b>C (C1–C2):</b> dłuższe teksty od razu w oryginale, streszczenie w 3 rundach.</li></ul><p class="small muted">Poziom rośnie sam: po każdym mówieniu Claude ocenia Twoją wypowiedź, a awans o 1–2 punkty przychodzi dopiero wtedy, gdy kilka ostatnich lekcji z co najmniej 2 różnych tematów jest powyżej Twojego wyniku. Pod przyciskiem lekcji widzisz mapę tematów: mocne i te do podciągnięcia. Gdy wybierzesz „Claude wymyśla”, co trzecia lekcja celuje w słabszy albo nowy temat. Metoda: Luca Lampariello, opis w zakładce O mnie.</p>`)}
  </div>`;
}

export async function act(a, k) {
  const S = C.S;
  switch (a) {
    case "toLang": S.view = "lang"; C.render(); C.scrollTop(); return true;
    case "openGrammar": S.gOpen = {}; S.view = "grammar"; C.render(); C.scrollTop(); return true;
    case "openGuide": S.view = "guide"; C.render(); C.scrollTop(); return true;
    case "gToggle": S.gOpen = S.gOpen || {}; S.gOpen[k] = !S.gOpen[k]; C.render(); return true;
  }
  return false;
}

/* ================= Ściągawka „?”: jak dobrze zrobić ten krok ================= */
// [poziomy, tekst]: poziomy "ABC" = dla wszystkich, "A" = tylko poziom A itd.
const HELP = {
  review: ["Powtórka", [["ABC", "Przeczytaj polskie zdanie i spróbuj powiedzieć całe zdanie w języku nauki, nie tylko brakujący zwrot."], ["ABC", "Najpierw z pamięci, dopiero potem wpisz albo podyktuj."], ["A", "Wystarczy sam zwrot. Powiedz go na głos 2 razy."], ["BC", "Mów naturalnym tempem, jakbyś to mówił w rozmowie."], ["ABC", "Błąd to nic złego: zwrot wróci na końcu powtórki i w kolejnych dniach."]]],
  translate: ["Tłumaczenie", [["ABC", "Przeczytaj polską wersję i zrozum sens całej sceny."], ["ABC", "Przy każdej kwestii pomyśl, jak powiedziałbyś to w języku nauki, zanim zobaczysz oryginał."], ["A", "Zerknij na tłumaczenie dosłowne: pokazuje, jak zdanie jest zbudowane."], ["ABC", "Nie szukaj ideału. Chodzi o próbę, za chwilę porównasz ją z oryginałem."]]],
  original: ["Oryginał", [["ABC", "Czytaj na głos zdanie po zdaniu."], ["ABC", "Porównuj z tym, co przed chwilą sam wymyśliłeś. Różnice to Twoja nauka."], ["ABC", "Stukaj zakreślone zwroty: dostaniesz wyjaśnienie, a zwrot trafi do banku."], ["A", "Przy trudnym słowie stuknij głośnik i powtórz za lektorem."], ["BC", "Zwróć uwagę, jak Niemiec, Hiszpan czy Włoch mówi to inaczej niż Polak."]]],
  listen: ["Słuchanie", [["ABC", "Najpierw posłuchaj całości bez patrzenia w tekst („Odtwórz całość”)."], ["ABC", "Drugi raz z tekstem. Zatrzymuj się po trudnych kwestiach."], ["ABC", "Powtarzaj za lektorem tym samym rytmem i melodią (shadowing)."], ["A", "Za szybko? Zwolnij tempo w O mnie → Lektor."]]],
  read: ["Czytanie", [["ABC", "Przeczytaj tekst raz w całości dla sensu, drugi raz wolniej."], ["ABC", "Zapisuj zwroty, których sam chcesz używać, a nie pojedyncze słowa."], ["ABC", "Jeden akapit przeczytaj na głos."]]],
  grammar: ["Gramatyka", [["ABC", "Przeczytaj zasadę i przykład, a potem wymyśl własne zdanie z tym wzorem."], ["ABC", "Poszukaj tego wzoru w dzisiejszym dialogu."], ["ABC", "Nie ucz się reguł na pamięć. Zasada trafia do „Moja gramatyka”, wrócisz do niej."]]],
  baro: ["Barometr", [["ABC", "Oceń szczerze, od tego zależy trudność kolejnych lekcji."], ["ABC", "„W sam raz” to: rozumiesz większość, ale musisz się skupić."]]],
  speak: ["Mówienie", [["ABC", "Najpierw pomyśl, potem mów na głos albo podyktuj. Nie tłumacz słowo w słowo z polskiego."], ["ABC", "Użyj 2–3 zwrotów z dzisiejszej lekcji."], ["A", "Wystarczą 2–3 krótkie, pełne zdania."], ["B", "Celuj w 5–6 zdań: odpowiedz i dodaj jeden szczegół albo przykład."], ["C", "Mów jak w rozmowie: uzasadnij zdanie, dodaj przykład, zadaj pytanie."], ["ABC", "Po poprawce przeczytaj poprawioną wersję na głos 2 razy."]]],
  wIntro: ["Nowe słówka", [["ABC", "Odsłuchaj słówko i powtórz na głos 2 razy."], ["ABC", "Wymowa jest zapisana polskimi literami, wielkie litery to akcent."], ["ABC", "Przeczytaj przykład i wyobraź sobie tę sytuację. Zdanie zapamiętasz lepiej niż samo słowo."]]],
  wPractice: ["Ćwiczenie", [["ABC", "Odpowiadaj z pamięci, zanim spojrzysz na podpowiedzi."], ["ABC", "Gdy wpisujesz słówko, powiedz je też na głos."], ["ABC", "Błędne słówko wróci kilka pozycji dalej, to normalne."]]],
  wReview: ["Powtórka słówek", [["ABC", "Najpierw powiedz całe zdanie na głos, potem sprawdź."], ["ABC", "Oceniaj uczciwie „Umiałem / Jeszcze nie”: od tego zależy termin następnej powtórki."]]]
};
export function helpPop(key, mode) {
  const h = HELP[key]; if (!h) return "";
  const tips = h[1].filter(([lv]) => lv.includes(mode || "B")).map(([, t]) => t);
  return `<div class="overlay clear" data-act="helpClose"><div class="helppop" role="dialog" aria-label="Jak to zrobić: ${C.esc(h[0])}">
    <div class="row"><b>${C.esc(h[0])}: jak to zrobić</b><button class="x" data-act="helpClose" aria-label="Zamknij">${C.I.close}</button></div>
    <ul class="tips">${tips.map(t => `<li>${C.esc(t)}</li>`).join("")}</ul></div></div>`;
}
export const helpBtn = key => `<button class="helpbtn" data-act="help" data-k="${key}" aria-label="Jak zrobić ten krok">?</button>`;

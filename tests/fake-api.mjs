// Gotowe odpowiedzi udawanego serwera /api (zamiast prawdziwego Claude'a).
export const LESSON = { title: "Kawa w Berlinie", topic_tag: "food", intro: "Zamów kawę.",
  lines: [{ speaker: "Barista", me: false, text: "Hallo! Was möchtest du?", translation: "Cześć! Co dla ciebie?", chunks: [{ text: "Was möchtest du", meaning: "co chcesz", how: "möchtest = forma od mögen" }] },
          { speaker: "Bartek", me: true, text: "Ich möchte gern einen Kaffee.", translation: "Chętnie kawę.", literal: "Ja chciałbym chętnie jedną kawę.", chunks: [{ text: "Ich möchte gern", meaning: "chętnie bym", how: "" }] }],
  contrasts: [{ pl: "Chętnie wypiję kawę.", target: "Ich möchte gern einen Kaffee.", literal: "Ja chciałbym chętnie jedną kawę.", why: "Niemcy grzecznie zamawiają przez „möchte gern”, a „gern” znaczy „chętnie”." }],
  grammar: [{ title: "Czasownik na 2. miejscu", category: "word_order", rule: "Czasownik stoi na drugim miejscu.", example: "Ich möchte gern einen Kaffee.", example_tr: "Chętnie kawę.", extra: "Heute spiele ich.", extra_tr: "Dziś gram." }],
  activation: { name: "Chunk Mixer", task: "Ułóż zdanie", chunks: ["ich möchte gern"], hint: "o weekendzie" } };

export function fakeAnswer(a, body) {
  return {
    vocative: { vocative: "Bartku" },
    placement_questions: { questions: [{ q: "Q1", options: ["a", "b", "c"], correct: 0 }], writing_prompt: "Napisz" },
    placement_grade: { score: 50, reason: "ok" },
    plan: { plan: "Twój plan." },
    lesson: { lesson_id: 99, content: { ...LESSON, mode: body.lang === "en" ? "B" : "A", level: "A1" } },
    review: { cards: (body.chunks || []).map(c => ({ chunk: c.chunk, prompt_native: "Chętnie herbatę", before: "", after: "einen Tee.", answer: c.chunk })) },
    check: { ok: false, explanation: "Nie" },
    feedback: { praise: "Super", corrected: "Am Wochenende möchte ich gern spielen.", fixes: ["a"], more: [], new_chunks: [], mistake_note: "", score_estimate: 30 },
    enrich: { words: (body.words || []).map(x => ({ chunk: x.chunk, meaning: x.meaning || "znaczenie " + x.chunk, pron: "PRON", ex: "Das ist {" + x.chunk + "} gut.", ex_pl: "To jest dobre.", tip: "wskazówka", fam: [] })) }
  }[a] || {};
}

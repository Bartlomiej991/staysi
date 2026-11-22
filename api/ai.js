// Jedno wejście do Claude dla całej aplikacji. Akcja w polu "action".
// Serwer sam dokłada z bazy tylko ten kontekst, który jest potrzebny do zadania.
import { admin, getUser, checkLimits, claudeJson, send, HttpError } from "../lib/server.js";

export const config = { maxDuration: 180 };

const LANG = { pl: "Polish", de: "German", es: "Spanish", fr: "French", en: "English", it: "Italian" };
const BANDS = [["A1", 22, 29], ["A2", 30, 35], ["A2+", 36, 42], ["B1", 43, 50], ["B1+", 51, 58], ["B2", 59, 66], ["B2+", 67, 75], ["C1", 76, 84], ["C2", 85, 90]];
const level = s => (BANDS.find(b => s <= b[2]) || BANDS[BANDS.length - 1])[0];
const mode = s => (s < 43 ? "A" : s < 76 ? "B" : "C");

const METHOD = `You are the tutor inside STAYSI, a language app built on Luca Lampariello's three pillars:
acquisition (interesting, comprehensible input at i+1, about 85-90% known words, translation first for lower levels),
retention (spaced repetition, the same chunks met again in new contexts, active recall),
activation (speak and write from day one, "express over impress", correct only what matters most).
Teach CHUNKS (useful multi-word phrases), not isolated words. Be warm, concise and encouraging.
Always answer with a single JSON object and nothing else.`;

// Model piszący lekcje. Domyślnie Sonnet (naturalny język); w Vercel można ustawić LESSON_MODEL=opus albo haiku.
const LESSON_MODEL = ["haiku", "sonnet", "opus"].includes(process.env.LESSON_MODEL) ? process.env.LESSON_MODEL : "sonnet";

const TOPICS = ["work", "travel", "food", "health", "home", "shopping", "errands", "hobbies", "tech", "culture", "relationships", "education", "nature", "society"];
const SIZE = {
  10: { lines: "6-8", tasks: 1 }, 15: { lines: "10-12", tasks: 2 },
  30: { lines: "12-14 plus one short follow-up paragraph", tasks: 3 }, 45: { lines: "14-16 plus a second short text", tasks: 4 }
};

async function readArticle(url) {
  let u; try { u = new URL(url); } catch { throw new HttpError(400, "To nie wygląda na poprawny link."); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, "Obsługiwane są tylko linki http i https.");
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 STAYSI" } });
    if (!r.ok) throw new Error();
    const html = (await r.text()).slice(0, 400000);
    return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 12000);
  } catch { throw new HttpError(400, "Nie udało się pobrać tej strony. Możesz wkleić jej tekst."); }
  finally { clearTimeout(t); }
}

// Drugi krok lekcji: osobny "redaktor" przepisuje tłumaczenia na naturalny, potoczny język ucznia.
// Pisząc dialog i tłumaczenie naraz, model kopiuje budowę obcego zdania; redaktor widzi tylko sens.
export async function naturalize(db, { userId, lang, L, native, content }) {
  const lines = (content.lines || []).map((l, i) => ({ i, speaker: l.speaker, original: l.text, translation: l.translation }));
  const contrasts = (content.contrasts || []).map((c, i) => ({ i, original: c.target, translation: c.pl }));
  if (!lines.length) return;
  try {
    const out = await claudeJson(db, { userId, model: LESSON_MODEL, purpose: "lesson_edit", lang, maxTokens: 400 + lines.length * 120,
      system: `You are a native ${native} editor of subtitles for a TV series. You make dialogue sound exactly like real people talk in ${native}. Always answer with a single JSON object and nothing else.`,
      messages: [{ role: "user", content: `Below is a ${L} conversation with draft ${native} translations. The drafts copy ${L} sentence structure, so they sound translated.
Rewrite every translation so it is what a ${native} speaker would actually say in this situation, out loud, to a friend: colloquial, short, natural word order and natural ${native} expressions. Keep the meaning and the tone; you may change words and structure freely (e.g. Polish: "A ilu będzie ludzi?" -> "A kto będzie?" or "A ile osób przyjdzie?"; "To wezmę dodatkowo mnóstwo chipsów" -> "No to biorę więcej chipsów"). Keep names. If a draft already sounds natural, keep it.
Conversation: ${JSON.stringify(lines)}
Comparison sentences (how a ${native} speaker would say the original): ${JSON.stringify(contrasts)}
Return JSON {"lines":[{"i": number, "translation": string}], "contrasts":[{"i": number, "translation": string}]}.` }] });
    for (const e of out.lines || []) if (content.lines[e.i] && typeof e.translation === "string" && e.translation.trim()) content.lines[e.i].translation = e.translation.trim();
    for (const e of out.contrasts || []) if (content.contrasts?.[e.i] && typeof e.translation === "string" && e.translation.trim()) content.contrasts[e.i].pl = e.translation.trim();
  } catch (e) { console.error("Redakcja tłumaczeń nie wyszła, zostają szkice:", e.message); }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Użyj POST." });
  const db = admin();
  try {
    const user = await getUser(req, db);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { action } = body;
    const uid = user.id;

    const { data: profile } = await db.from("profiles").select("*").eq("id", uid).single();
    const native = LANG[profile?.native] || "Polish";

    if (action === "vocative") {
      await checkLimits(db, uid, action);
      const parsed = await claudeJson(db, { userId: uid, purpose: action, maxTokens: 60,
        system: "Return JSON {\"vocative\": string}: the friendly Polish vocative of the given first name as used in an informal greeting, keeping the same form of the name (e.g. Bartek -> Bartku, Tomek -> Tomku, Kasia -> Kasiu, Anna -> Anno, Michał -> Michale). If the name is not Polish or you are unsure, return it unchanged.",
        messages: [{ role: "user", content: String(body.name || "").slice(0, 40) }] });
      return send(res, 200, parsed);
    }

    if (action === "placement_questions") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang]; const lvl = level(Number(body.self_score) || 44);
      const parsed = await claudeJson(db, { userId: uid, model: "sonnet", purpose: "placement", lang: body.lang, maxTokens: 2000,
        system: METHOD,
        messages: [{ role: "user", content: `Create a short placement test for ${L}. The learner rates themselves around ${lvl}. Native language: ${native}.
Return JSON {"questions":[{"q":string,"options":[string,string,string],"correct":0|1|2}], "writing_prompt": string}.
Make 4 multiple-choice questions spanning one level below to one level above ${lvl} (reading comprehension, grammar in context, vocabulary in context).
Write instructions in ${native}; target-language content in ${L}. The writing prompt asks for 3-5 sentences about themselves, in ${native}.` }] });
      return send(res, 200, parsed);
    }

    if (action === "placement_grade") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const parsed = await claudeJson(db, { userId: uid, model: "sonnet", purpose: "placement", lang: body.lang, maxTokens: 400,
        system: METHOD,
        messages: [{ role: "user", content: `Grade this ${L} placement test against CEFR descriptors. Self-rating score: ${body.self_score} on the 10-90 Global Scale of English style scale (A1 22-29, A2 30-35, A2+ 36-42, B1 43-50, B1+ 51-58, B2 59-66, B2+ 67-75, C1 76-84, C2 85-90).
Multiple-choice results: ${JSON.stringify(body.answers || []).slice(0, 2000)}
Writing sample: """${String(body.writing || "").slice(0, 1500)}"""
Return JSON {"score": integer 22-90, "reason": one or two sentences in ${native} explaining the level}.` }] });
      const out = parsed; out.score = Math.max(22, Math.min(90, Math.round(Number(out.score) || 22)));
      await db.from("user_languages").upsert({ user_id: uid, lang: body.lang, score: out.score }, { onConflict: "user_id,lang" });
      out.level = level(out.score);
      return send(res, 200, out);
    }

    if (action === "plan") {
      await checkLimits(db, uid, action);
      const { data: langs } = await db.from("user_languages").select("lang,score").eq("user_id", uid);
      const list = (langs || []).map(l => `${LANG[l.lang]} ${level(l.score)}`).join(", ");
      const parsed = await claudeJson(db, { userId: uid, model: "sonnet", purpose: "plan", maxTokens: 500,
        system: METHOD,
        messages: [{ role: "user", content: `Learner: ${profile.name}. Job: ${profile.job}. City: ${profile.city}. About: ${profile.about}. Interests: ${(profile.interests || []).join(", ")}. Goal: ${profile.goal}. Languages: ${list}.
Write a personal study plan in ${native}: 3-4 short sentences, concrete, warm, mentioning which method fits each language level (A: short dialogues about their life + review chain + chunk mixer; B: texts and podcasts on their interests + staggered echo + language islands; C: semi-extensive reading + vocab vault + progressive compression) and recommending a daily time.
Return JSON {"plan": string}.` }] });
      return send(res, 200, parsed);
    }

    if (action === "lesson") {
      await checkLimits(db, uid, "lesson");
      const lang = body.lang; const L = LANG[lang];
      const minutes = [10, 15, 30, 45].includes(Number(body.minutes)) ? Number(body.minutes) : 15;
      const { data: ul } = await db.from("user_languages").select("*").eq("user_id", uid).eq("lang", lang).single();
      if (!ul) throw new HttpError(400, "Najpierw dodaj ten język.");
      const score = Math.max(22, Math.min(90, ul.score + (ul.difficulty_shift || 0) * 2));
      const md = mode(score); const lvl = level(score);
      const { data: mistakes } = await db.from("mistakes").select("note").eq("user_id", uid).eq("lang", lang).order("created_at", { ascending: false }).limit(3);
      const { data: known } = await db.from("bank").select("chunk").eq("user_id", uid).eq("lang", lang).order("created_at", { ascending: false }).limit(25);
      const { data: gram } = await db.from("grammar").select("title").eq("user_id", uid).eq("lang", lang).order("updated_at", { ascending: false }).limit(20);
      // Mapa tematów: co trzecia lekcja "Claude wymyśla" celuje w słaby albo nowy temat
      const { data: rated } = await db.from("lessons").select("topic,estimate").eq("user_id", uid).eq("lang", lang).not("estimate", "is", null).order("completed_at", { ascending: false }).limit(100);
      const byTopic = {};
      for (const r of rated || []) if (r.topic) (byTopic[r.topic] = byTopic[r.topic] || []).push(r.estimate);
      const weak = Object.entries(byTopic).map(([t, v]) => [t, v.reduce((a, b) => a + b, 0) / v.length]).filter(([, avg]) => avg < ul.score - 3).sort((a, b) => a[1] - b[1]).map(([t]) => t).slice(0, 3);
      const unseen = TOPICS.filter(t => !byTopic[t]);
      let source = String(body.source_text || "").slice(0, 12000);
      if (!source && body.source_url) source = await readArticle(body.source_url);
      const topic = String(body.topic || "").slice(0, 200);
      const size = SIZE[minutes];
      const form = md === "A"
        ? `a natural everyday dialogue of ${size.lines} lines between the learner ("me": true, speaker = the learner's name) and another person (a friend, colleague, neighbour, shop assistant...), set in one concrete situation from the learner's everyday life`
        : md === "B"
          ? `a lively podcast-style conversation of ${size.lines} lines between two hosts (all "me": false) on the topic`
          : `an engaging prose passage of 3-5 paragraphs (each paragraph is one line, speaker "", "me": false) for semi-extensive reading, literary or journalistic in style; vivid and concrete, with any quoted speech following the same natural-dialogue rules`;
      const activation = md === "A"
        ? `"Chunk Mixer": the learner builds their own sentence about themselves from 2-3 chunks (today's and older ones).`
        : md === "B"
          ? `"Language Islands": a ~2-minute personal talk (or 4-6 written sentences) on a personal question linked to the topic.`
          : `"Progressive Compression": summarise the passage and give an opinion, in 3 rounds of 3, 2 and 1 minutes.`;
      const notes = String(profile.style_notes || "").trim().slice(-1500);
      const prompt = `Create one STAYSI lesson in ${L}.
${notes ? `THE LEARNER'S OWN FEEDBACK ON PREVIOUS LESSONS. This overrides any other style instruction below:\n"""${notes}"""\n` : ""}
WHAT MATTERS MOST: the text must sound like real people talking, so the learner can steal phrases for their own life (Luca Lampariello: interesting, natural input; "express over impress").
- Write ONE small scene with a reason to talk: a plan to make, a problem to solve, news to share, a small surprise or disagreement. It has a beginning, a turn and an ending.
- Every line reacts to the line before it: answers the question, reacts ("Echt?", "No way!", "Ach so"), asks back, adds a detail. No two lines in a row that could be swapped without anyone noticing.
- Introductions and personal facts (name, job) are fine when the scene calls for them, e.g. people meeting. What is NOT fine is a line that ignores the previous one or drops a fact out of nowhere.
- Use the learner card below only as background for the topic. Use at most ONE detail from it, woven in naturally. Do not quote it.
- Spoken language for the level: short turns, contractions, fillers and reactions native speakers really use, ellipsis, everyday register. Simple is fine at A1; stiff or textbook-like is not. Each line max ~12 words at A levels.
- Give the other person a personality and their own life (a name, a mood, an opinion). The learner's character can be "me".
- Chunks are high-frequency, reusable expressions (e.g. "Hast du Lust, ...?", "Wie wär's mit ...?", "Ich hab keine Ahnung"), not rare nouns.
- Translations into ${native} are what a ${native} speaker would actually say in that exact situation, colloquial, even if that means different words or structure (e.g. Polish "moja drużyna nie gra w ten weekend", not "moja drużyna nie ma meczu"). Never mirror the ${L} structure in the main translation: that is what "literal" is for (Luca: understand the meaning first).
- Keep the logic tight: words like "too", "also", "so" must refer to something actually said before.
- Do not cram several chunks into one line. One or two useful chunks per line, the way people really talk.${md === "A" ? `
- Luca also compares the two languages to notice how they differ. So for lines whose ${L} structure differs noticeably from ${native} (word order, a preposition, an extra word, an idiom), add "literal": a word-for-word ${native} rendering that mirrors the ${L} structure, e.g. "Hast du Lust auf Kaffee?" -> "Masz (ty) ochotę na kawę?". Use "" when the structure is the same. Do this for about a third of the lines, where it teaches something.` : ""}
- Before you answer, read the dialogue aloud in your head: would two native speakers really say exactly this, in this order? If any line sounds like a textbook or a form, rewrite it.

Learner card (background only): name ${profile.name}; job ${profile.job}; city ${profile.city}; about ${profile.about}; interests ${(profile.interests || []).join(", ")}; goal ${profile.goal}; native language ${native}.
Level: ${lvl} (mode ${md}). Recent mistakes to gently recycle: ${(mistakes || []).map(m => m.note).join(" | ") || "none"}.
Chunks they already know (reuse 2-3 for repetition, do not mark them as new): ${(known || []).map(k => k.chunk).join(", ") || "none"}.
${!source && !body.source_url && !topic && (ul.lessons_done || 0) % 3 === 2 && (weak.length || unseen.length) ? `Today, stretch the learner: pick a topic from ${weak.length ? `their weaker areas (${weak.join(", ")})` : ""}${weak.length && unseen.length ? " or " : ""}${unseen.length ? `areas they have not practised yet (${unseen.slice(0, 5).join(", ")})` : ""}, linked to their life where possible.\n` : ""}${source ? `Base the lesson on this source, adapted to ${lvl} (simplify vocabulary and grammar for A levels, keep the original style for C):\n"""${source}"""` : topic ? `Topic chosen by the learner: ${topic}.` : `Pick a fresh, concrete everyday situation linked to the learner's interests or daily life.`}
Format: ${form}. About 10-15% of the words should be new for a ${lvl} learner.
Mark 4-7 useful NEW chunks per lesson, each copied EXACTLY as it appears in a line.
Grammar: after reading, the learner sees 2-3 short notes on how the language works in THIS text (noticing, not a lecture). ${md === "A" ? "Pick basics: word order, articles and gender, verb endings, plurals, the most common irregular verbs, question forms." : md === "B" ? "Pick intermediate points: tenses and when to use them, cases, connectors, reflexive or separable verbs, typical collocations." : "Pick advanced points: nuance, register, style, idiomatic structures, near-synonyms."}
Patterns the learner already met: ${(gram || []).map(g => g.title).join(" | ") || "none"}. Use 1-2 of them naturally in the text. Prefer new patterns in the notes; if you revisit a known one, use its exact title and add something new.
Return JSON:
{"title": short catchy title in ${native} with one fitting emoji at the start,
 "topic_tag": the general area of this lesson, exactly one of ${JSON.stringify(TOPICS)},
 "intro": one encouraging sentence in ${native},
 "lines": [{"speaker": string, "me": boolean, "gender": "f" or "m" for the speaker (for the learner's own lines guess from the learner's name; "" for narration), "text": string in ${L}, "translation": string in ${native},${md === "A" ? ` "literal": word-for-word ${native} or "",` : ""} "chunks": [{"text": exact substring of text, "meaning": short meaning in ${native}, "how": one short line in ${native} on how the chunk is built (form, ending, word order; ALWAYS name irregular forms, e.g. "ging = czas przeszły od gehen, nieregularny"), "" if there is nothing to explain}]}],
 "contrasts": [0-4 items, ONLY for sentences from the lines where ${L} says it genuinely differently from ${native} (word order, a different verb or preposition, an idiom, a habit native speakers have). Skip anything that is said the same way; an empty list is fine. Each item {"pl": how a ${native} speaker would naturally say it, "target": the ${L} sentence or fragment copied EXACTLY from the lines, "literal": word-for-word ${native} mirroring the ${L} structure, "why": 1-2 simple sentences in ${native}, at the learner's level, explaining why ${L} speakers say it this way (the rule, the habit or the logic), so the learner can say it like a native}],
 "grammar": [2-3 items {"title": short name of the pattern in ${native}, max 6 words, "category": one of "word_order","verbs","nouns","adjectives","prepositions","pronouns","other", "rule": 1-2 simple sentences in ${native} at the learner's level, "example": one sentence copied EXACTLY from the lines that shows it, "example_tr": its translation in ${native}, "extra": one more short ${L} example at the learner's level, "extra_tr": its translation}],
 "activation": {"name": "${md === "A" ? "Chunk Mixer" : md === "B" ? "Language Islands" : "Progressive Compression"}", "task": instruction in ${native} following ${activation}, "chunks": [2-3 chunks to use], "hint": short hint in ${native}}}`;
      const parsed = await claudeJson(db, { userId: uid, model: LESSON_MODEL, purpose: "lesson", lang, maxTokens: 6000, system: METHOD, messages: [{ role: "user", content: prompt }] });
      const content = parsed; content.mode = md; content.level = lvl;
      await naturalize(db, { userId: uid, lang, L, native, content });
      const tag = TOPICS.includes(content.topic_tag) ? content.topic_tag : null; content.topic_tag = tag;
      let { data: row, error } = await db.from("lessons").insert({ user_id: uid, lang, minutes, content, topic: tag }).select("id").single();
      if (error) ({ data: row, error } = await db.from("lessons").insert({ user_id: uid, lang, minutes, content }).select("id").single()); // gdy 004_tematy.sql nie jest jeszcze uruchomiony
      if (error) throw new HttpError(500, "Nie udało się zapisać lekcji.");
      return send(res, 200, { lesson_id: row.id, content });
    }

    if (action === "review") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang]; const chunks = (body.chunks || []).slice(0, 20);
      if (!chunks.length) return send(res, 200, { cards: [] });
      const { data: ul } = await db.from("user_languages").select("score").eq("user_id", uid).eq("lang", body.lang).single();
      const parsed = await claudeJson(db, { userId: uid, purpose: "review", lang: body.lang, maxTokens: 1800, system: METHOD,
        messages: [{ role: "user", content: `Level ${level(ul?.score || 22)}. For each ${L} chunk below write a NEW short sentence (different from its old context) that uses the chunk naturally, so the learner meets it in a fresh context.
Chunks: ${JSON.stringify(chunks)}
Return JSON {"cards":[{"chunk": the chunk exactly as given, "prompt_native": the whole sentence translated to ${native}, "before": text before the chunk, "after": text after the chunk, "answer": the chunk as it appears in the sentence (may be inflected)}]}.` }] });
      return send(res, 200, parsed);
    }

    if (action === "check") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const parsed = await claudeJson(db, { userId: uid, purpose: "check", lang: body.lang, maxTokens: 200, system: METHOD,
        messages: [{ role: "user", content: `${L} gap-fill. Meaning (${native}): "${String(body.prompt_native).slice(0, 300)}". Sentence: "${String(body.before).slice(0, 200)} ___ ${String(body.after).slice(0, 200)}". Expected: "${String(body.expected).slice(0, 100)}". Learner wrote: "${String(body.given).slice(0, 100)}".
Accept it if it is correct and natural even if different from the expected answer; small typos are fine. Return JSON {"ok": boolean, "explanation": one short sentence in ${native}}.` }] });
      return send(res, 200, parsed);
    }

    if (action === "feedback") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const answer = Array.isArray(body.rounds) ? body.rounds.map((r, i) => `Round ${i + 1}: ${String(r).slice(0, 2000)}`).join("\n") : String(body.answer || "").slice(0, 3000);
      const { data: ul } = await db.from("user_languages").select("score").eq("user_id", uid).eq("lang", body.lang).single();
      const parsed = await claudeJson(db, { userId: uid, purpose: "feedback", lang: body.lang, maxTokens: 1200, system: METHOD,
        messages: [{ role: "user", content: `Learner level ${level(ul?.score || 22)}, ${L}. Task: ${String(body.task).slice(0, 500)}
Learner's answer:\n${answer}
Give feedback in ${native}, "express over impress": praise first, then only the 2-3 most important fixes.
Return JSON {"praise": string, "corrected": improved natural version in ${L} (of the last round if there are rounds), "fixes": [2-3 short explanations], "more": [other minor fixes, may be empty], "new_chunks": [{"text": useful chunk from the corrected version, "meaning": in ${native}}], "mistake_note": one short note about the most typical mistake or "", "score_estimate": integer 10-90 for this answer on the same scale (A1 22-29 ... C2 85-90)}.` }] });
      const out = parsed;
      if (out.mistake_note) await db.from("mistakes").insert({ user_id: uid, lang: body.lang, note: String(out.mistake_note).slice(0, 300) });
      return send(res, 200, out);
    }

    if (action === "enrich") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const words = (body.words || []).slice(0, 10).map(w => ({ chunk: String(w.chunk || "").slice(0, 80), meaning: String(w.meaning || "").slice(0, 120), context: String(w.context || "").slice(0, 300) })).filter(w => w.chunk);
      if (!words.length) return send(res, 200, { words: [] });
      const { data: ul } = await db.from("user_languages").select("score").eq("user_id", uid).eq("lang", body.lang).single();
      const lvl = level(ul?.score || 22), md = mode(ul?.score || 22);
      const style = md === "A"
        ? `The learner is a beginner (${lvl}). Example sentences: 4-8 words, present tense, only the most common everyday words, about the learner's own life (home, food, family, work, weekend). No subordinate clauses, no idioms. Tips: simple, about one basic thing (article, plural, pronunciation).`
        : md === "B"
          ? `The learner is intermediate (${lvl}). Example sentences: 8-15 words, natural spoken style, common tenses, one simple subordinate clause is fine. Tips may mention collocations or common mistakes.`
          : `The learner is advanced (${lvl}). Example sentences: 12-22 words, rich and idiomatic, as in good journalism or literature. Tips may cover register, nuance and near-synonyms.`;
      const parsed = await claudeJson(db, { userId: uid, purpose: "enrich", lang: body.lang, maxTokens: 400 + words.length * 350, system: METHOD,
        messages: [{ role: "user", content: `Make study cards for these ${L} words or phrases for a ${lvl} learner whose native language is ${native}. If the learner gave a meaning or a sentence where they met the word, respect it.
${style} Everything except the item itself must be easy for this learner to understand.
Items: ${JSON.stringify(words)}
Return JSON {"words":[{
 "chunk": the item exactly as given (fix only obvious typos),
 "meaning": short meaning in ${native} (1-4 words, several separated by commas if needed),
 "pron": pronunciation for a ${native} speaker written with ${native} spelling, syllables separated by hyphens, stressed syllable in CAPITALS (e.g. KE-rek-ter), "" if obvious,
 "ex": one natural ${L} example sentence at the learner's level where the item appears wrapped in curly braces exactly once, e.g. "My brother has a strong {character}." (inflect inside the braces if grammar needs it),
 "ex_pl": that sentence translated to ${native},
 "tip": one short tip in ${native}: if the item is or contains an irregular verb or an irregular plural or form, the tip MUST show its key forms (e.g. "gehen – ging – gegangen", "go – went – gone", "das Buch – die Bücher"); otherwise a short grammar note, false friend warning or memory tip, or "",
 "fam": [[related word, part of speech abbreviation in ${native}, meaning in ${native}, pronunciation like pron]] with 0-3 entries from the same word family or the opposite, [] if none
}]}` }] });
      return send(res, 200, parsed);
    }

    if (action === "photo") {
      await checkLimits(db, uid, action);
      const img = String(body.image || "");
      const m = img.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) throw new HttpError(400, "Nie rozpoznano zdjęcia.");
      if (m[2].length > 4_000_000) throw new HttpError(413, "Zdjęcie jest za duże.");
      const L = LANG[body.lang];
      const parsed = await claudeJson(db, { userId: uid, purpose: "photo", lang: body.lang, maxTokens: 800, system: METHOD,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
          { type: "text", text: `This is a photo of a ${L} book page. Find the words or phrases the reader highlighted or underlined (if none are marked, pick up to 5 genuinely useful advanced ones). Return JSON {"words":[{"chunk": string, "meaning": in ${native}, "context": the full sentence from the page}]}. Max 10.` }
        ] }] });
      return send(res, 200, parsed);
    }

    throw new HttpError(400, "Nieznana akcja.");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return send(res, status, { error: e instanceof HttpError ? e.message : "Coś poszło nie tak. Spróbuj ponownie." });
  }
}

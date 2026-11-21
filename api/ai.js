// Jedno wejście do Claude dla całej aplikacji. Akcja w polu "action".
// Serwer sam dokłada z bazy tylko ten kontekst, który jest potrzebny do zadania.
import { admin, getUser, checkLimits, claude, parseJson, send, HttpError } from "../lib/server.js";

export const config = { maxDuration: 60 };

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
      const { text } = await claude(db, { userId: uid, purpose: action, maxTokens: 60,
        system: "Return JSON {\"vocative\": string}: the friendly Polish vocative of the given first name as used in an informal greeting, keeping the same form of the name (e.g. Bartek -> Bartku, Tomek -> Tomku, Kasia -> Kasiu, Anna -> Anno, Michał -> Michale). If the name is not Polish or you are unsure, return it unchanged.",
        messages: [{ role: "user", content: String(body.name || "").slice(0, 40) }] });
      return send(res, 200, parseJson(text));
    }

    if (action === "placement_questions") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang]; const lvl = level(Number(body.self_score) || 44);
      const { text } = await claude(db, { userId: uid, model: "sonnet", purpose: "placement", lang: body.lang, maxTokens: 1200,
        system: METHOD,
        messages: [{ role: "user", content: `Create a short placement test for ${L}. The learner rates themselves around ${lvl}. Native language: ${native}.
Return JSON {"questions":[{"q":string,"options":[string,string,string],"correct":0|1|2}], "writing_prompt": string}.
Make 4 multiple-choice questions spanning one level below to one level above ${lvl} (reading comprehension, grammar in context, vocabulary in context).
Write instructions in ${native}; target-language content in ${L}. The writing prompt asks for 3-5 sentences about themselves, in ${native}.` }] });
      return send(res, 200, parseJson(text));
    }

    if (action === "placement_grade") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const { text } = await claude(db, { userId: uid, model: "sonnet", purpose: "placement", lang: body.lang, maxTokens: 400,
        system: METHOD,
        messages: [{ role: "user", content: `Grade this ${L} placement test against CEFR descriptors. Self-rating score: ${body.self_score} on the 10-90 Global Scale of English style scale (A1 22-29, A2 30-35, A2+ 36-42, B1 43-50, B1+ 51-58, B2 59-66, B2+ 67-75, C1 76-84, C2 85-90).
Multiple-choice results: ${JSON.stringify(body.answers || []).slice(0, 2000)}
Writing sample: """${String(body.writing || "").slice(0, 1500)}"""
Return JSON {"score": integer 22-90, "reason": one or two sentences in ${native} explaining the level}.` }] });
      const out = parseJson(text); out.score = Math.max(22, Math.min(90, Math.round(Number(out.score) || 22)));
      await db.from("user_languages").upsert({ user_id: uid, lang: body.lang, score: out.score }, { onConflict: "user_id,lang" });
      out.level = level(out.score);
      return send(res, 200, out);
    }

    if (action === "plan") {
      await checkLimits(db, uid, action);
      const { data: langs } = await db.from("user_languages").select("lang,score").eq("user_id", uid);
      const list = (langs || []).map(l => `${LANG[l.lang]} ${level(l.score)}`).join(", ");
      const { text } = await claude(db, { userId: uid, model: "sonnet", purpose: "plan", maxTokens: 500,
        system: METHOD,
        messages: [{ role: "user", content: `Learner: ${profile.name}. Job: ${profile.job}. City: ${profile.city}. About: ${profile.about}. Interests: ${(profile.interests || []).join(", ")}. Goal: ${profile.goal}. Languages: ${list}.
Write a personal study plan in ${native}: 3-4 short sentences, concrete, warm, mentioning which method fits each language level (A: short dialogues about their life + review chain + chunk mixer; B: texts and podcasts on their interests + staggered echo + language islands; C: semi-extensive reading + vocab vault + progressive compression) and recommending a daily time.
Return JSON {"plan": string}.` }] });
      return send(res, 200, parseJson(text));
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
      let source = String(body.source_text || "").slice(0, 12000);
      if (!source && body.source_url) source = await readArticle(body.source_url);
      const topic = String(body.topic || "").slice(0, 200);
      const size = SIZE[minutes];
      const form = md === "A"
        ? `a natural everyday dialogue of ${size.lines} lines between the learner ("me": true, speaker = the learner's name) and another person, about the learner's own life`
        : md === "B"
          ? `a lively podcast-style conversation of ${size.lines} lines between two hosts (all "me": false) on the topic`
          : `an engaging prose passage of 3-5 paragraphs (each paragraph is one line, speaker "", "me": false) for semi-extensive reading, literary or journalistic in style`;
      const activation = md === "A"
        ? `"Chunk Mixer": the learner builds their own sentence about themselves from 2-3 chunks (today's and older ones).`
        : md === "B"
          ? `"Language Islands": a ~2-minute personal talk (or 4-6 written sentences) on a personal question linked to the topic.`
          : `"Progressive Compression": summarise the passage and give an opinion, in 3 rounds of 3, 2 and 1 minutes.`;
      const prompt = `Create one STAYSI lesson in ${L} for this learner.
Learner card: name ${profile.name}; job ${profile.job}; city ${profile.city}; about ${profile.about}; interests ${(profile.interests || []).join(", ")}; goal ${profile.goal}; native language ${native}.
Level: ${lvl} (mode ${md}). Recent mistakes to gently recycle: ${(mistakes || []).map(m => m.note).join(" | ") || "none"}.
Chunks they already know (reuse 2-3 for repetition, do not mark them as new): ${(known || []).map(k => k.chunk).join(", ") || "none"}.
${source ? `Base the lesson on this source, adapted to ${lvl} (simplify vocabulary and grammar for A levels, keep the original style for C):\n"""${source}"""` : topic ? `Topic chosen by the learner: ${topic}.` : `Pick a fresh topic from the learner's interests or daily life.`}
Format: ${form}. About 10-15% of the words should be new for a ${lvl} learner.
Mark 4-7 useful NEW chunks per lesson, each copied EXACTLY as it appears in a line.
Return JSON:
{"title": short catchy title in ${native} with one fitting emoji at the start,
 "intro": one encouraging sentence in ${native},
 "lines": [{"speaker": string, "me": boolean, "text": string in ${L}, "translation": string in ${native}, "chunks": [{"text": exact substring of text, "meaning": short meaning in ${native}}]}],
 "activation": {"name": "${md === "A" ? "Chunk Mixer" : md === "B" ? "Language Islands" : "Progressive Compression"}", "task": instruction in ${native} following ${activation}, "chunks": [2-3 chunks to use], "hint": short hint in ${native}}}`;
      const { text } = await claude(db, { userId: uid, purpose: "lesson", lang, maxTokens: 3500, system: METHOD, messages: [{ role: "user", content: prompt }] });
      const content = parseJson(text); content.mode = md; content.level = lvl;
      const { data: row, error } = await db.from("lessons").insert({ user_id: uid, lang, minutes, content }).select("id").single();
      if (error) throw new HttpError(500, "Nie udało się zapisać lekcji.");
      return send(res, 200, { lesson_id: row.id, content });
    }

    if (action === "review") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang]; const chunks = (body.chunks || []).slice(0, 20);
      if (!chunks.length) return send(res, 200, { cards: [] });
      const { data: ul } = await db.from("user_languages").select("score").eq("user_id", uid).eq("lang", body.lang).single();
      const { text } = await claude(db, { userId: uid, purpose: "review", lang: body.lang, maxTokens: 1800, system: METHOD,
        messages: [{ role: "user", content: `Level ${level(ul?.score || 22)}. For each ${L} chunk below write a NEW short sentence (different from its old context) that uses the chunk naturally, so the learner meets it in a fresh context.
Chunks: ${JSON.stringify(chunks)}
Return JSON {"cards":[{"chunk": the chunk exactly as given, "prompt_native": the whole sentence translated to ${native}, "before": text before the chunk, "after": text after the chunk, "answer": the chunk as it appears in the sentence (may be inflected)}]}.` }] });
      return send(res, 200, parseJson(text));
    }

    if (action === "check") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const { text } = await claude(db, { userId: uid, purpose: "check", lang: body.lang, maxTokens: 200, system: METHOD,
        messages: [{ role: "user", content: `${L} gap-fill. Meaning (${native}): "${String(body.prompt_native).slice(0, 300)}". Sentence: "${String(body.before).slice(0, 200)} ___ ${String(body.after).slice(0, 200)}". Expected: "${String(body.expected).slice(0, 100)}". Learner wrote: "${String(body.given).slice(0, 100)}".
Accept it if it is correct and natural even if different from the expected answer; small typos are fine. Return JSON {"ok": boolean, "explanation": one short sentence in ${native}}.` }] });
      return send(res, 200, parseJson(text));
    }

    if (action === "feedback") {
      await checkLimits(db, uid, action);
      const L = LANG[body.lang];
      const answer = Array.isArray(body.rounds) ? body.rounds.map((r, i) => `Round ${i + 1}: ${String(r).slice(0, 2000)}`).join("\n") : String(body.answer || "").slice(0, 3000);
      const { data: ul } = await db.from("user_languages").select("score").eq("user_id", uid).eq("lang", body.lang).single();
      const { text } = await claude(db, { userId: uid, purpose: "feedback", lang: body.lang, maxTokens: 1200, system: METHOD,
        messages: [{ role: "user", content: `Learner level ${level(ul?.score || 22)}, ${L}. Task: ${String(body.task).slice(0, 500)}
Learner's answer:\n${answer}
Give feedback in ${native}, "express over impress": praise first, then only the 2-3 most important fixes.
Return JSON {"praise": string, "corrected": improved natural version in ${L} (of the last round if there are rounds), "fixes": [2-3 short explanations], "more": [other minor fixes, may be empty], "new_chunks": [{"text": useful chunk from the corrected version, "meaning": in ${native}}], "mistake_note": one short note about the most typical mistake or "", "score_estimate": integer 10-90 for this answer on the same scale (A1 22-29 ... C2 85-90)}.` }] });
      const out = parseJson(text);
      if (out.mistake_note) await db.from("mistakes").insert({ user_id: uid, lang: body.lang, note: String(out.mistake_note).slice(0, 300) });
      return send(res, 200, out);
    }

    if (action === "photo") {
      await checkLimits(db, uid, action);
      const img = String(body.image || "");
      const m = img.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) throw new HttpError(400, "Nie rozpoznano zdjęcia.");
      if (m[2].length > 4_000_000) throw new HttpError(413, "Zdjęcie jest za duże.");
      const L = LANG[body.lang];
      const { text } = await claude(db, { userId: uid, purpose: "photo", lang: body.lang, maxTokens: 800, system: METHOD,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
          { type: "text", text: `This is a photo of a ${L} book page. Find the words or phrases the reader highlighted or underlined (if none are marked, pick up to 5 genuinely useful advanced ones). Return JSON {"words":[{"chunk": string, "meaning": in ${native}, "context": the full sentence from the page}]}. Max 10.` }
        ] }] });
      return send(res, 200, parseJson(text));
    }

    throw new HttpError(400, "Nieznana akcja.");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return send(res, status, { error: e instanceof HttpError ? e.message : "Coś poszło nie tak. Spróbuj ponownie." });
  }
}

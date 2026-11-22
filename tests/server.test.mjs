// Testy serwera: czytanie odpowiedzi Claude'a i ponawianie, gdy JSON jest ucięty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeJson, parseJson } from "../lib/server.js";

test("parseJson radzi sobie z ```json i zbędnymi przecinkami", () => {
  assert.deepEqual(parseJson('```json\n{"a":[1,2,],}\n```'), { a: [1, 2] });
  assert.deepEqual(parseJson('Proszę:\n{"ok": true}'), { ok: true });
});

test("claudeJson ponawia zapytanie z większym limitem, gdy odpowiedź jest ucięta", async () => {
  const calls = [];
  globalThis.fetch = async (url, opt) => {
    calls.push(JSON.parse(opt.body));
    const first = calls.length === 1;
    const text = first ? '{"questions":[{"q":"Was?"' : '{"questions":[{"q":"Was?"}]}';
    return { ok: true, json: async () => ({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: first ? "max_tokens" : "end_turn" }) };
  };
  const logged = [];
  const db = { from: () => ({ insert: async row => { logged.push(row); return {}; } }) };
  const out = await claudeJson(db, { userId: "u", system: "s", messages: [{ role: "user", content: "x" }], maxTokens: 1000, purpose: "placement" });
  assert.deepEqual(out, { questions: [{ q: "Was?" }] });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].max_tokens, 2000);
  assert.equal(logged.length, 2, "oba zapytania zapisane w kosztach");
});

test("redaktor tłumaczeń podmienia kalki na naturalny polski, a przy błędzie zostawia szkic", async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "x";
  const { naturalize } = await import("../api/ai.js");
  const db = { from: () => ({ insert: async () => ({}) }) };
  const content = { lines: [{ speaker: "Bartek", text: "Klar! Wie viele Leute kommen eigentlich?", translation: "Jasne! A ilu będzie ludzi?" }],
    contrasts: [{ target: "Wie viele Leute kommen eigentlich?", pl: "A ilu będzie ludzi?" }] };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: '{"lines":[{"i":0,"translation":"Jasne, a kto będzie?"}],"contrasts":[{"i":0,"translation":"A kto w ogóle przyjdzie?"}]}' }], usage: { input_tokens: 5, output_tokens: 5 }, stop_reason: "end_turn" }) });
  await naturalize(db, { userId: "u", lang: "de", L: "German", native: "Polish", content });
  assert.equal(content.lines[0].translation, "Jasne, a kto będzie?");
  assert.equal(content.contrasts[0].pl, "A kto w ogóle przyjdzie?");
  globalThis.fetch = async () => { throw new Error("sieć leży"); };
  await naturalize(db, { userId: "u", lang: "de", L: "German", native: "Polish", content });
  assert.equal(content.lines[0].translation, "Jasne, a kto będzie?", "przy błędzie lekcja nie przepada");
});

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

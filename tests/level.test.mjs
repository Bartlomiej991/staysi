// Zasady poziomu: kalibracja w 5 pierwszych lekcjach, potem awans tylko z kilku lekcji i co najmniej 2 tematów.
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextScore, median } from "../public/learn.js";

const r = (...pairs) => pairs.map(([estimate, topic]) => ({ estimate, topic }));

test("mediana", () => { assert.equal(median([70, 45, 46]), 46); assert.equal(median([50, 60]), 55); });

test("kalibracja (lekcje 1–5) przesuwa wynik o 40% w obie strony", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 2 }, r([60, "work"])).score, 54);
  assert.equal(nextScore({ score: 50, lessons_done: 2 }, r([40, "work"])).score, 46);
});

test("po kalibracji: jeden temat nie daje awansu", () => {
  const out = nextScore({ score: 50, lessons_done: 10 }, r([60, "work"], [61, "work"], [62, "work"]));
  assert.equal(out.score, 50); assert.equal(out.why, "need-more");
});

test("po kalibracji: za mało lekcji nie daje awansu", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 10 }, r([60, "work"], [60, "health"])).score, 50);
});

test("awans o 1 punkt, gdy mediana z kilku tematów jest wyższa", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 10 }, r([53, "work"], [52, "health"], [55, "food"])).score, 51);
});

test("awans o 2 punkty, gdy mediana jest wyższa o co najmniej 8", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 10 }, r([60, "work"], [58, "health"], [62, "food"])).score, 52);
});

test("jedna świetna lekcja wśród słabszych nie daje awansu", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 10 }, r([70, "work"], [45, "health"], [46, "food"], [47, "travel"], [48, "home"])).score, 50);
});

test("po kalibracji wynik nigdy nie spada", () => {
  assert.equal(nextScore({ score: 50, lessons_done: 10 }, r([30, "work"], [30, "health"], [30, "food"])).score, 50);
});

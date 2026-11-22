// Sprawdza, czy każdy plik z kodem da się w ogóle wczytać (literówka w kodzie = czerwony test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["api", "lib", "public"].flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith(".js")).map(f => path.join(d, f)));

for (const f of files) test(`składnia: ${f}`, () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", path.join(ROOT, f)], { stdio: "pipe" }));
});

test("w repozytorium nie ma kluczy", () => {
  const bad = /AIza[0-9A-Za-z_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOi[A-Za-z0-9_-]{30,}/;
  const all = [...files, "README.md", ".env.example", "docs/INSTRUKCJA.md"].filter(f => fs.existsSync(path.join(ROOT, f)));
  for (const f of all) assert.ok(!bad.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `podejrzany klucz w ${f}`);
});

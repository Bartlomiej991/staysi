# STAYSI

[![CI](https://github.com/Bartlomiej991/staysi/actions/workflows/ci.yml/badge.svg)](https://github.com/Bartlomiej991/staysi/actions/workflows/ci.yml)

A mobile-first language-learning app that turns Luca Lampariello's three-pillar method into a daily routine, with Claude as a personal tutor.

**Languages:** Polish, German, Spanish, French, English, Italian · **Levels:** A1–C2 · **Installs as a home-screen app (PWA)** on iPhone and Android

## The problem

Most learners memorise word lists and still freeze when they try to speak. STAYSI is built around three pillars instead:

| Pillar | What the app does |
| --- | --- |
| **Retention** | Every lesson starts with spaced-repetition cards. Each phrase ("chunk") has a strength from 0 to 5 and comes back after 1, 3, 7, 14 or 30 days. The same chunk appears in a *new* sentence every time. |
| **Acquisition** | Claude writes a dialogue, podcast-style conversation or reading passage about the learner's own life and interests, at roughly 85–90% known words. Learners can also bring their own topic, article link or text. |
| **Activation** | The learner writes or speaks an answer. Claude praises first, then corrects only the 2–3 most important mistakes. |

The method adapts to the level:

| Level | New material | Review | Speaking |
| --- | --- | --- | --- |
| A1–A2 | Short dialogues about the learner's life, translation first | Review chain | Chunk Mixer |
| B1–B2 | Podcast-style conversations and articles | Staggered Echo | Language Islands |
| C1–C2 | Semi-extensive reading, photos of the learner's own book pages | Vocab Vault | Progressive Compression (3 → 2 → 1 min) |

## How it works

```
Phone (PWA) ──► Vercel function /api/ai ──► Claude API
     │                  │
     └──► Supabase ◄────┘  (auth, Postgres with Row Level Security, usage log)
```

- **Claude never sees more than it needs.** The server pulls a small, task-specific slice of the learner's data from the database (level, interests, weakest chunks, recent mistakes) and adds it to each request. This is retrieval-augmented generation with rule-based retrieval instead of vector search, because the data is structured.
- **Two models, chosen by task.** Claude Haiku 5.5 for everyday lesson work; Claude Sonnet 5.5 for the placement test and the study plan.
- **Cost control built in.** Every request's token usage is logged and priced. Each user has a monthly budget, there is a daily lesson limit, and an optional global cap. The *Costs* tab shows spending per model, per language and per lesson.
- **Levels on a 10–90 scale** modelled on the Global Scale of English, so "a good B2" and "almost C1" are different numbers. Promotion is automatic; the first five lessons calibrate the level in both directions, after that it only goes up.
- **Security.** API keys live only in Vercel environment variables. The browser gets the public Supabase key, and Row Level Security makes every row readable only by its owner.

## Tech stack

Vanilla JavaScript (ES modules, no build step) · Vercel serverless functions (Node 20) · Supabase (Auth + Postgres + RLS) · Claude API with prompt caching · Web Speech API for text-to-speech and dictation · GitHub Actions + Vercel Deployment Checks (CI/CD) · node:test + jsdom

## Project structure

```
api/ai.js            all Claude actions: lesson, review, check, feedback, placement, plan, photo, word cards
api/config.js        public client config
lib/server.js        auth check, Claude call with JSON retry, cost logging, limits
public/app.js        screens, lessons, onboarding, placement, back navigation
public/words.js      language screen and spaced-repetition word bank
public/learn.js      grammar notes ("My grammar") and the in-app learning guide
supabase/            schema.sql (tables, RLS, grants) and incremental migrations
tests/               end-to-end UI test in jsdom with fake Supabase and API, server and syntax tests
.github/workflows/   CI: runs the tests on every push
docs/                product plan and setup guide
```

## Testing and CI/CD

`npm test` runs 26 tests with Node's built-in test runner. The main one drives the whole app in jsdom the way a user would (onboarding, placement test, a full lesson, the word bank, grammar notes, back navigation) against an in-memory fake of Supabase and the API, so it needs no keys and costs nothing. Other tests cover the level rules (calibration, then promotion only from the median of the last five lessons across at least two topics), the JSON-retry logic for Claude responses, syntax of every source file and a scan for leaked keys.

On every push GitHub Actions runs the suite. Vercel builds each commit, but a Deployment Check holds the release until the `tests` job passes, so a broken build never reaches production.

## Running your own copy

See [docs/INSTRUKCJA.md](docs/INSTRUKCJA.md) (Polish). In short: run `supabase/schema.sql` in a Supabase project, import the repo in Vercel, and set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

## Credits

The learning method is inspired by the work of [Luca Lampariello](https://lucalampariello.com). STAYSI is an independent project and is not affiliated with him.

Built by Bartłomiej with Claude as a coding assistant: I designed the product, made the decisions and directed the work; Claude helped write the code.

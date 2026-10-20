# BlaXaura — implementation plan

Derived from `BLAXAURA_AGENT_SPEC.md`. Written before implementation, updated as slices landed.

## Principles applied to every decision

1. Fun first, contact second — the report is never gated.
2. Transparent participation — the welcome screen says the host can see anything typed.
3. Respectful analysis — scores describe *choices*, never appearance.
4. The API key never reaches the browser; Gemini is optional and always has a deterministic fallback.
5. Minimal collection and no Android contact integration.

## Slices

| # | Slice | Contents | Status |
| --- | --- | --- | --- |
| 0 | Foundations | npm workspaces, TypeScript configs, Tailwind 4 tokens, `.gitignore`, `.env.example`, lint/typecheck scripts | done |
| 1 | Shared domain | Question bank (8 questions, skip + "prefer not to say"), documented scoring rules, archetype matching, deterministic fallback report, Zod schemas | done |
| 2 | Welcome + quiz | Aurora welcome, name step (optional), one question per screen, progress, Back/Skip, conversation cards, keyboard radio navigation, GSAP transitions | done |
| 3 | Deterministic report | `/api/report`, reveal animation, archetype, score ring, dimension meters, strengths, experiments, conversation starter, disclaimer, offline/local fallback button | done |
| 4 | Gemini integration | `@google/genai` writer, structured output, reviewed archetype allow-list, prompt with hard content rules, sanitisation + banned-phrase rejection, timeout, one retry, graceful fallback | done |
| 5 | Feedback | 1–5 stars for the experience, tags, 500-char comment, retry intent, skip; stored independently of contacts | done |
| 6 | Consented contacts | Optional name + phone, unchecked consent (server-enforced), libphonenumber-js normalisation, duplicate handling, server-side consent timestamp, prominent skip | done |
| 7 | Host dashboard | Argon2id password, server-side sessions, HttpOnly + SameSite cookies, CSRF double-submit, origin checks, rate-limited login, stats, contacts, feedback, retention purge, CSV export with formula-injection guards | done |
| 8 | Polish | 320 px layouts, reduced motion, focus states, lazy-loaded admin bundle, explicit icon registry (bundle −570 KB), single-port production serving, security headers | done |
| 9 | Verification | 55 server/shared tests, 12 client tests, 12 Playwright E2E tests, lint, typecheck, production build | done |
| 10 | Documentation | README, research notes, privacy & threat model, troubleshooting, Fedora/LAN instructions | done |

## Key decisions and why

- **Deterministic-first reporting.** The fallback is not a degraded path; it is the reference implementation of BlaXaura's voice. Gemini re-writes prose from the same grounded inputs, so an outage changes tone, never substance.
- **Scores are computed before the model is called** and are never taken from the model. Gemini is told the archetype and readings and may only produce text.
- **Reviewed archetype allow-list** in the structured-output schema. Unknown titles are mapped back to a reviewed one rather than displayed.
- **Server-side sessions, not localStorage flags.** Only the SHA-256 of the session token is stored, so deleting a row logs the host out immediately.
- **No `<input type="hidden">`-style consent.** The client requires the checkbox for UX, but the server independently requires `consent: true` and writes its own timestamp.
- **CSS aurora instead of WebGL.** The spec allows Three.js, but a mid-range Android phone does not need a GPU shader for a halo; CSS gradients plus `prefers-reduced-motion` give the same effect at a fraction of the cost.
- **In-memory participant state with `sessionStorage` mirroring.** No participant data in URLs; wiped on finish and restart.
- **Lazy-loaded admin route + explicit icon registry** keep the participant bundle at ~575 KB raw / 187 KB gzipped instead of >1.1 MB.

## Deviations from the spec (and why)

- **shadcn/ui**: implemented in the same pattern (Radix primitives + CVA + `cn()`), but vendored by hand rather than via the CLI so the design language (midnight/plum/rose) is applied consistently and no unused components ship. No 21st.dev or Three.js components were used.
- **Zod v4** instead of v3 — current, and `safeParse`/`.strict()` behaviour is what the routes rely on.
- **better-sqlite3 requires Node ≥ 22**; the repo declares `engines.node >= 20.19` for Vite 8 and documents Node 22 as the recommended runtime. Database logic is isolated in `apps/server/src/db` and covered by tests, so swapping for `node:sqlite` is contained work.
- **Admin PIN** was implemented as a password (the spec allows either) with a 10-character minimum.

## Verified against reality

- Gemini model IDs were checked against the live model documentation in October 2026; `gemini-3.8-flash` is the default and `GEMINI_MODEL` is configurable.
- Every endpoint, screen and failure path listed in the "Definition of done" was exercised by an automated test.

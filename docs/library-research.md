# Library & model research notes (checked October 2026)

The spec asked for a check of official docs before choosing components. These are the findings that shaped the build.

## Gemini

- SDK: **`@google/genai`** (the current official Node SDK; the legacy `@google/generative-ai` is deprecated).
- Models listed as current on the Gemini API docs at build time included `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`, plus older `gemini-2.5-*` models that are scheduled for shutdown on **2026-10-20**.
- Default chosen: **`gemini-3.8-flash`** — current, fast, supports structured output. `GEMINI_MODEL` overrides it; if the configured model is unavailable the request fails safely and the deterministic report is served.
- Structured output: `config: { responseMimeType: 'application/json', responseSchema: {...} }` is supported by the SDK; the schema is expressed with lowercase JSON-Schema types (verified against current examples). Responses are still validated with Zod before display.
- The spec's example name "Gemini 3.5 Flash Flashlight" does not exist and was not used.

## Frontend

- **React 19 + Vite 7 + TypeScript 5.9**: current stable combination; Vite 7 is used rather than 8 so the app runs on the Node 20 LTS line that many Fedora installs still ship.
- **Tailwind CSS 4** via `@tailwindcss/vite`: CSS-first configuration with `@theme` tokens — no `tailwind.config.js` needed.
- **Radix primitives** (`checkbox`, `dialog`, `label`, `slot`) for accessible behaviour; **CVA** + `tailwind-merge` + `clsx` for variants. This is the shadcn/ui pattern applied by hand, which avoided shipping components the design does not use.
- **GSAP 3.15** for the welcome and reveal timelines, always behind a `prefers-reduced-motion` guard. The reveal also falls back to static layout when GSAP is skipped.
- **`lucide-react`**: importing `* as Icons` pulled ~1.1 MB into the bundle, so the icon registry is explicit (`apps/web/src/components/OptionIcon.tsx`) and admin is a lazy route.
- **Fonts**: the design calls for a display serif. Loading a webfont would cost a network round-trip and break the offline spirit, so the display face is a system serif stack (Iowan Old Style → Palatino → Georgia) with the sans body in the system UI stack.

## Backend

- **Fastify 5** with `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/static`.
- **better-sqlite3 12** — synchronous, fast, ideal for a single-device app; migrations are forward-only and run in transactions. Note the Node ≥ 22 engine requirement.
- **`@node-rs/argon2`** — Argon2id (19 MiB, t=2, p=1) without a native build step.
- **`libphonenumber-js`** — E.164 normalisation with Nigeria as the default region so `0803…` works, while any international number is accepted.
- **Zod 4** for request validation and AI-response validation.

## Deliberately not used

- Three.js / ThreeUI: unnecessary GPU cost on mid-range phones for a blurred halo.
- Any analytics, session-replay or ad SDK.
- Any component whose licence was unclear.

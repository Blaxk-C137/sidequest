# Privacy, security and threat model

BlaXaura is a **transparent, local contact-exchange** tool used in person. The person holding the phone can see anything entered on it. That is stated on the welcome screen, in the "What happens to my answers?" dialog and on the fact that the host dashboard lists every saved contact.

## What is stored

| Table | Columns | Notes |
| --- | --- | --- |
| `sessions` | `id` (uuid), `created_at`, `completed_at`, `report_mode` | No answers, no name, no number. Used only for completion counts. |
| `feedback` | `id`, `session_id` (nullable), `stars`, `tags` (JSON), `comment`, `retry_intent`, `created_at` | Never stores a phone number or name. |
| `contacts` | `id`, `display_name`, `normalized_phone` (unique), `consent_text_version`, `consented_at`, `created_at` | Written only after an explicit `consent: true`. |
| `admin_settings` | `key`, `value` (`admin_password_hash`) | Argon2id hash only. |
| `admin_sessions` | `token_hash`, `created_at`, `expires_at`, `user_agent` | Only the SHA-256 of the cookie token. |

The database lives at `DATABASE_PATH` (default `data/blaxaura.sqlite`), outside any public directory and excluded from git.

## What never leaves the device

- Names, phone numbers and feedback are **never** sent to Gemini or any third party.
- The Gemini prompt contains only the nine answer labels (eight questions plus "skipped").
- No analytics, fonts, CDNs or telemetry scripts are loaded — the client only talks to its own origin.

## Consent

- The checkbox is unchecked by default, its wording is versioned (`2026-10-v1`) and stored with the contact.
- The client disables the save button without consent, but the **server is authoritative**: `consent: true` is required by the Zod schema, and `consented_at` is generated server-side. A client-supplied timestamp is ignored.
- Declining is a full-width button of equal visual weight, and the thank-you screen treats both paths as complete.

## Authentication & session security

- Argon2id (19 MiB, t=2, p=1); no plaintext password is ever stored or logged.
- 32-byte random session token in an `HttpOnly`, `SameSite=Strict` cookie; only its hash is stored, so logout and expiry are enforced server-side.
- Mutations require a double-submit CSRF token (`x-csrf-token` must equal the readable cookie) **and** an `Origin`/`Host` match when an `Origin` header is present.
- Login is rate-limited to 6 attempts per 10 minutes per client; setup is limited to 5.
- `COOKIE_SECURE=true` should be set whenever the app is served over HTTPS.

## Input handling

- Every public route validates with Zod; unknown keys are rejected on the report payload.
- Phone numbers are parsed and normalised with `libphonenumber-js`; premium/shared-cost ranges are rejected; duplicates return `409` rather than creating a second row.
- Feedback tags are filtered against the reviewed list; comments are trimmed to 500 characters rather than failing the request.
- CSV export quotes fields and prefixes `=`, `+`, `-`, `@` with `'` to defuse spreadsheet formula injection.
- AI output is sanitised (tags/control characters stripped, lengths capped) and rejected outright if it mentions appearance, body, weight or having "seen" the participant.

## Response & transport hardening

Security headers on every response: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geolocation off), `Cross-Origin-Opener-Policy: same-origin`, plus a strict CSP on HTML (`default-src 'self'`, no inline scripts beyond styles). CORS is not enabled: the client is same-origin, in dev through the Vite proxy.

## Logs

Pino redaction covers cookies, CSRF headers, authorisation headers and any `phone`/`password` field. `lib/sanitize.ts` also provides `redactPhone()` for ad-hoc logging. The Gemini API key is read once at boot and never logged or serialised into a response.

## Threat model

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Stranger at the counter reads previous participants' data | State wiped on finish/restart; no data in URLs; dashboard requires a password | Someone with the unlocked dashboard open can read it |
| Phone number harvested without consent | Server-enforced consent flag + versioned consent text + timestamp | The number is still visible to the host, as disclosed |
| Brute-force of the host password | Argon2id + per-client rate limit on login | Weak passwords chosen by the host (10-char minimum enforced) |
| CSRF against admin mutations | Double-submit token + origin check + SameSite=Strict | None known for same-origin deployments |
| Prompt injection via answers | Answers are constrained to known option ids; output is schema-validated, sanitised and allow-listed | A model could still write something odd but harmless; banned-phrase filter catches the harmful cases |
| LAN sniffing | Documented warning; HTTPS recommended | Plain HTTP on a shared network is observable |
| Malicious CSV consumer | Formula injection guarded | A determined attacker can still mislead with plain text |
| Data retention | Per-row delete, clear-all, retention purge by age | Requires the host to actually use them |

## Before deploying beyond localhost

1. Terminate TLS (Caddy/nginx) and set `COOKIE_SECURE=true`, `TRUST_PROXY=true`.
2. Put the host dashboard behind an additional network control (VPN, IP allow-list) — it is a local admin tool, not a public one.
3. Re-check local data-protection obligations: consent wording, retention period, who can access the device.
4. Consider encrypting the volume that holds the SQLite file; the app does not encrypt at rest.

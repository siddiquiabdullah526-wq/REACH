# API

All routes except `/api/webhooks/*`, `/api/login` and `/api/health` need the dashboard session cookie.

| Method + route | Request | Result |
|---|---|---|
| `GET /api/health` | | providers, storage, demo mode |
| `POST /api/login` / `DELETE /api/login` | `{ password }` | sets / clears the session cookie |
| `GET /api/contacts` | | contacts (phone shown as last 4 only) |
| `GET /api/notices` | | notices with every version |
| `POST /api/notices` | `{ title, body_en, body_es, mode, approved }` | saved notice |
| `POST /api/notices/:id/start` | `{ version, contact_ids }` | outreach IDs; idempotent per contact + version |
| `GET /api/notices/:id/status?version=1` | | dashboard object (`notice`, `rows`, `refreshed_at`, `meta`) |
| `POST /api/notices/:id/replace` | `{ expected_version, title, body_en, body_es, change_note }` | new version; 409 if stale |
| `POST /api/notices/:id/cancel` | | stops retries; late replies get flagged |
| `GET /api/notices/:id/report?version=` | | reach rate, median time to acknowledge, needs, languages, reasons |
| `GET /api/notices/:id/followup?version=&format=csv` | | door-knock list (JSON or CSV) |
| `GET /api/outreach/:id` | | outreach record, attempts, text replies |
| `PATCH /api/outreach/:id/assistance` | `{ assistance_status, note }` | coordinator only path to `closed` |
| `POST /api/outreach/:id/review` | `{ note }` | clears `needs_review` |
| `POST /api/outreach/:id/retry` | `{ channel: "voice" | "sms" }` | new attempt |
| `POST /api/webhooks/retell` | Retell events | verifies `X-Retell-Signature` on the raw body |
| `POST /api/webhooks/sms` | Twilio form, or JSON `{ provider_message_id, from_number, body }` | reply handling |
| `POST /api/sim/call` | `{ outreach_id, outcome }` | demo only: confirmed, needs_assistance, no_answer, voicemail, hung_up, opt_out |
| `POST /api/sim/sms` | `{ contact_id, body }` | demo only: a resident texts back |
| `POST /api/sim/network-failure` | `{ enabled }` | demo only |
| `POST /api/sim/reset` | | demo only: wipe and re-seed |

Simulated calls and texts go through the exact same handlers as real Retell and Twilio events.

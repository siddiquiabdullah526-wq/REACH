# REACH: notes for Claude Code (and the team)

REACH calls residents with an approved notice in their language, checks they understood, and shows
coordinators who needs a person. Next.js 14 App Router, TypeScript, no UI framework.

## Team rules (do not break these)
- IDs are strings. Times are ISO 8601 UTC (`2026-10-17T03:45:00Z`). The frontend displays Pacific time.
- Language codes: `en`, `es` for the MVP.
- `null` = unknown or unanswered. `false` = an explicit "no".
- Phone numbers are E.164 (`+19095551234`). Real, consented numbers only, and only in the private roster.
- Every interaction belongs to a contact + notice + notice version.
- The backend is the source of truth. The frontend only displays what it returns.
- Acknowledgment does not mean the person is safe or their request is resolved.
- Only one open SMS question per contact. A reply that could refer to an old notice gets flagged for review.
- Only a coordinator can set `assistance_status` to `closed`.
- Only approved notices can be sent. The agent never promises help is coming.

## Enums
- `contact_status`: pending | in_progress | acknowledged | not_reached | opted_out
- `assistance_status`: null | none | requested | in_progress | closed
- `delivery_status`: queued | ringing | completed | no_answer | voicemail | failed
- `failure_reason`: null | no_answer | voicemail | busy | network_down | invalid_number | provider_error | carrier_blocked | no_response | ivr_reached
- `review_reason`: did_not_understand | needs_not_confirmed_on_call | reply_may_refer_to_old_notice | reply_without_open_question | unrecognized_reply | reply_after_notice_cancelled

## Where things live
- `lib/types.ts`: every data shape, including the dashboard row contract.
- `lib/outreach.ts`: all business logic (start, dial, webhooks, SMS fallback, replies, report, follow-up list).
- `lib/retell.ts`: Retell API call, webhook signature check, disconnection-reason mapping.
- `lib/sms.ts`: SMS text, Twilio send, reply parsing. `lib/store.ts`: file or Postgres storage.
- `lib/regions.ts`: per-region config (Twist 2). `app/api/**`: thin route handlers. `app/dashboard`: coordinator UI.
- `docs/retell-prompt.md`: the agent prompt. `scripts/setup-retell.mjs` creates the agents from it.

## Before you push
`npm run test:logic` (no network needed) and `npm run build`. Keep network calls out of `mutate()` callbacks.

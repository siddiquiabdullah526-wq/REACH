# REACH

An alert isn't finished until someone can act on it. REACH calls residents in their language, reads an
approved notice, checks they understood, and shows coordinators who needs a person to follow up.

Built at the Dual-Use Hackathon (USC Viterbi × InnovateLA), Resilience Comms lens, by Rafid, Enzo and Abdullah.

## Run it in 2 minutes (no keys needed)

```bash
npm install
cp .env.example .env.local      # DEMO_MODE=true is already set
npm run dev
```

Open http://localhost:3000 (landing page) and http://localhost:3000/dashboard (password from `.env.local`).
Without Retell keys, calls are simulated: each card gets buttons to play out the call.

## The 90-second demo
1. Dashboard → pick **Evacuation warning (simulated)** → **Call 3 residents**.
2. On the cards: A **Confirms**, B **Needs help** (Spanish, transport + wheelchair), C **No answer** → C falls back to a text.
3. Click **Simulate a network outage**, then **Call again** on C. It fails with "Network down" and stays on the board.
4. **Open printable list** → the door-knock list.
5. Twist moment: **Update this notice** → save as version 2 → send it. The version tabs show who heard v1 vs v2.
6. Before demoing, **Reset demo data**.

## Checks
```bash
npm run test:logic   # 13 end-to-end logic checks, no network
npm run build
```

## Connect Retell (real calls)
1. Sign up at retellai.com, finish KYC (needed for outbound calls), add a payment method, buy a US number.
2. Deploy first (below) so you have a public https URL. For local dev use `ngrok http 3000`.
3. Pick voices in the Retell dashboard, then run:
   `RETELL_API_KEY=key_xxx PUBLIC_BASE_URL=https://your-url npm run setup:retell`
   It creates the prompt (`docs/retell-prompt.md`), an English (`en-US`) and a Spanish (`es-419`) agent with the
   post-call fields, do-not-call detection, voicemail handling and the webhook. It prints the agent IDs.
4. In Retell → Phone Numbers → your number → set the English agent as the **outbound** agent.
5. Set `RETELL_API_KEY`, `RETELL_FROM_NUMBER`, `RETELL_AGENT_ID_EN`, `RETELL_AGENT_ID_ES` and redeploy.
   Leave `RETELL_AGENT_VERSION` empty while building; set it to the published version number before the demo.
   Calls are started about one per second, because Retell's default limit is 1 call start per second.
6. Put your consented test numbers in `CONTACTS_JSON` (E.164), then **Reset demo data** so they load.

Webhook signatures are checked against `RETELL_API_KEY` (or `RETELL_WEBHOOK_KEY` if your webhook-badge key is a different one).
If every webhook returns 401, that key is wrong.

**Browser call button (landing page):** create a Retell public key, allow your domain and `localhost`, and set the
`NEXT_PUBLIC_RETELL_*` variables. It uses the v3 browser SDK (`RetellClient`); v2 is deprecated as of Oct 18, 2026.

## Deploy
**Render or Railway (simplest, tested path):** new Web Service from the repo, build `npm install && npm run build`,
start `npm start`, add the env vars. File storage works on a single server. Data resets if the server restarts,
which is fine for a demo, so reset and run through it right before judging.

**Vercel:** works, but serverless has no persistent disk, so you must set `DATABASE_URL` (Supabase or Neon, use
the pooled connection string). The table is created automatically. This path was not tested end to end yet, so
run the 90-second demo on it once before relying on it.

## Team split
- **Rafid:** deployment, website, Devpost, deck, demo video, twist log (`docs/TWIST_LOG.md`, `docs/DEVPOST_DRAFT.md`)
- **Enzo:** Retell agent, backend, SMS (`lib/outreach.ts`, `lib/retell.ts`, `lib/sms.ts`, `docs/retell-prompt.md`)
- **Abdullah:** dashboard (`app/dashboard`, `components/client-lib.ts`)

Rules and contract: `CLAUDE.md`. Routes: `docs/API.md`.

## Known limits
- SMS is simulated unless you have a 10DLC-registered Twilio number. The dashboard labels simulated texts.
- Retell-managed numbers can only call US numbers.
- Retell doesn't support Bengali yet; Hindi (`hi-IN`) and Urdu (`ur-IN`) are supported.
- Storage is one JSON document: fine for a demo, not for production.
- No phone system works through a complete network outage. REACH shows who it couldn't reach instead of hiding them.

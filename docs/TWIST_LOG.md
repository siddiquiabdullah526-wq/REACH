# Twist log (Rafid)

Fill each entry within ~30 minutes of the change landing. Times in UTC.

## Twist 1: Federal funding pathway
- Received: 2026-10-17T06:31:00Z (11:31 PM PT)
- What changed in the scenario: name a federal funding pathway for the venture
- Why it matters for residents: funding decides whether this reaches real buildings after the weekend
- Notice version: no change
- Agent/config change: none
- Backend/frontend change: impact report (`GET /api/notices/:id/report`) and the report strip on the dashboard: reach rate, median time to acknowledge, assistance requests, languages, not-reached reasons. These are the numbers an NSF SBIR/STTR Phase I proposal and a UASI-funded buyer would ask for.
- Owner(s):
- Proof: commit `____` · screenshot of the report strip
- Remaining limitation: numbers come from simulated and test calls only

## Twist 2: Make it global
- Received: 2026-10-17T11:30:00Z (4:30 AM PT)
- What changed in the scenario: show how the same solution works in another part of the world
- Why it matters for residents: basic-phone households and language barriers exist everywhere
- Notice version: no change
- Agent/config change: Hindi agent (`hi-IN`) for the example region. Retell does not support Bengali yet.
- Backend/frontend change: `lib/regions.ts` holds timezone, languages, alert authority and consent rule per region. Storage was already global: UTC times, E.164 phones, language codes.
- Owner(s):
- Proof: commit `____` · recording of a Hindi test call
- Remaining limitation: Odisha region is an example config, not a deployment; local telecom rules need checking

## Twist 3: Poster
- Received: 2026-10-17T14:00:00Z (7:00 AM PT)
- What changed in the scenario: make a poster, submit with Devpost by 10 PM
- Notice version: no change
- Agent/config change: none
- Backend/frontend change: none
- Owner(s):
- Proof: poster file on Devpost
- Remaining limitation:

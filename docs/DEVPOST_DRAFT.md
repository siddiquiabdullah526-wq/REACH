# REACH

**Lens:** Resilience Comms (Retell AI)

**One line:** An alert isn't finished until someone can act on it. REACH calls residents in their language, reads an approved notice, checks they understood, and shows coordinators who needs a person.

## The problem
Emergency alerts are broadcasts. They assume a smartphone, a data connection and English, and they never find out who heard them. The people most likely to miss an alert, like older residents, people on basic phones, and people who don't speak English, are also the most likely to need help acting on it.

## What it does
1. A coordinator picks an approved notice and the residents to reach.
2. A Retell voice agent calls each resident in their preferred language (English or Spanish in the MVP), reads the notice word for word, and asks: "Can you follow these instructions, or do you need assistance?"
3. If they need help, it asks about transportation, mobility needs and a call back, then reads the needs back to confirm. It never promises help is coming.
4. If a call fails, REACH falls back to a text with numbered replies (1 = can follow it, 2 = need help).
5. The dashboard sorts everyone into needs a person, not reached (with the reason), in progress, and heard it. Not-reached households print as a door-knock list.

**Dual use:** on a normal day it handles building notices like elevator maintenance. In a crisis, the same loop runs approved evacuation notices.

## How we built it
Next.js and TypeScript, Retell voice agents (post-call extraction feeds the dashboard), webhook signature verification, an SMS fallback (simulated in the demo since US SMS needs 10DLC registration), and JSON or Postgres storage. Simulated calls in the demo run through the exact same webhook handlers as real Retell calls.

## How we absorbed the twists
**Funding:** NSF SBIR/STTR Phase I (SBIR/STTR was reauthorized through 2031 in April 2026), pursued as an STTR with Cal Poly Pomona as the research partner, then city and county buyers using FEMA Homeland Security Grant Program (UASI) funds. We built an impact report with the numbers both would ask for: reach rate, time to acknowledge, assistance requests, languages served and not-reached reasons.

**Global:** everything location-specific (languages, timezone, alert authority, consent rules) lives in a region config. Our example second region is Odisha, India, where cyclone warnings need to reach households on basic phones, with a Hindi agent.

**Poster:** attached.

## Responsible use
Misuse risk: someone could send fake alerts or impersonate officials. We limit that by only sending notices marked approved, having the agent disclose it's automated, never promising help, honoring opt-outs immediately, verifying webhook signatures, and keeping call data for 7 days.

## What's next
Real deployments with a housing operator, more languages, integration with official alert feeds, and in-person follow-up assignment for coordinators.

## Built with
Retell AI, Next.js, TypeScript, Node.js, PostgreSQL (optional), Twilio (optional). Add IBM Bob here if you used it, and say how.

// One-time Retell setup: creates the shared LLM (prompt) and two agents (English + Spanish)
// with the post-call fields the dashboard reads, do-not-call detection, voicemail handling,
// and the webhook pointed at your deployed app.
//
//   RETELL_API_KEY=key_xxx PUBLIC_BASE_URL=https://your-app.onrender.com npm run setup:retell
//
// Optional: RETELL_VOICE_ID_EN, RETELL_VOICE_ID_ES (pick voices in the Retell dashboard first).
import fs from "fs";

const KEY = process.env.RETELL_API_KEY;
const BASE = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
if (!KEY || !BASE) {
  console.error("Set RETELL_API_KEY and PUBLIC_BASE_URL (your public https URL) first.");
  process.exit(1);
}

async function retell(path, body) {
  const res = await fetch(`https://api.retellai.com${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const prompt = fs.readFileSync(new URL("../docs/retell-prompt.md", import.meta.url), "utf8");

const postCall = [
  { type: "boolean", name: "understood", description: "True if the resident said they understood the notice and can follow it. False if they said they did not understand.", required: false },
  { type: "boolean", name: "needs_assistance", description: "True if the resident said they need any assistance to follow the notice. False if they said they do not.", required: false },
  { type: "boolean", name: "needs_transport", description: "True if the resident said they need transportation.", required: false },
  { type: "string", name: "mobility_needs", description: "Any mobility or medical equipment needs in the household, in a few words, in English. Empty if none were mentioned.", required: false },
  { type: "boolean", name: "callback_requested", description: "True if the resident asked for a call back from a coordinator.", required: false },
  { type: "boolean", name: "needs_confirmed", description: "True if the agent read the needs back and the resident confirmed they were correct.", required: false },
  { type: "boolean", name: "opted_out", description: "True if the resident asked not to be called or contacted again.", required: false },
];

const llm = await retell("/create-retell-llm", {
  general_prompt: prompt,
  start_speaker: "agent",
  model_temperature: 0,
});
console.log("Created LLM", llm.llm_id);

const ids = {};
const versions = {};
for (const [lang, locale, voice] of [
  ["en", "en-US", process.env.RETELL_VOICE_ID_EN || "retell-Cimo"],
  ["es", "es-419", process.env.RETELL_VOICE_ID_ES || process.env.RETELL_VOICE_ID_EN || "retell-Cimo"],
]) {
  const agent = await retell("/create-agent", {
    agent_name: `REACH (${lang.toUpperCase()})`,
    response_engine: { type: "retell-llm", llm_id: llm.llm_id },
    voice_id: voice,
    language: locale,
    webhook_url: `${BASE}/api/webhooks/retell`,
    post_call_analysis_data: postCall,
    enable_dnc_detection: true,
    voicemail_option: {
      action: {
        type: "prompt",
        text: "Leave one short message in {{preferred_language}}: you are an automated assistant for {{organization_name}} with a notice titled {{notice_title}}, and a text message will follow. Do not include any personal details.",
      },
    },
    max_call_duration_ms: 240000,
    end_call_after_silence_ms: 30000,
    data_storage_retention_days: 7,
    handbook_config: { ai_disclosure: true, scope_boundaries: true, echo_verification: true },
  });
  ids[lang] = agent.agent_id;
  versions[lang] = agent.version ?? 0;
  console.log(`Created ${lang} agent`, agent.agent_id);
  try {
    await retell(`/publish-agent-version/${agent.agent_id}`, { version: agent.version ?? 0, version_title: "hackathon v1" });
    console.log(`Published ${lang} agent`);
  } catch (e) {
    console.warn(`Could not publish ${lang} agent (calls still use the latest draft): ${e.message}`);
  }
}

console.log(`
Done. Add these to your environment:

RETELL_AGENT_ID_EN=${ids.en}
RETELL_AGENT_ID_ES=${ids.es}
NEXT_PUBLIC_RETELL_WEB_AGENT_ID_EN=${ids.en}
NEXT_PUBLIC_RETELL_WEB_AGENT_ID_ES=${ids.es}

For the demo, pin the version so edits can't change behavior mid-demo:
RETELL_AGENT_VERSION=${versions.en}
(If you edit the prompt in the dashboard later, publish it and update this number.)

Then in the Retell dashboard: Phone Numbers -> your number -> set the English agent as the outbound agent.
`);

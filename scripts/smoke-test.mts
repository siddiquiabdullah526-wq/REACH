// End-to-end logic test with no network: simulated voice + simulated SMS + file storage.
// Run: npm run test:logic
import assert from "assert";
import fs from "fs";
import crypto from "crypto";

process.env.DATA_FILE = ".data/smoke-test.json";
process.env.DEMO_MODE = "true";
delete process.env.RETELL_API_KEY;
delete process.env.DATABASE_URL;
fs.rmSync(".data/smoke-test.json", { force: true });

const o = await import("../lib/outreach");
const { verifyRetellSignature } = await import("../lib/retell");
const { readDb } = await import("../lib/store");

const row = async (noticeId: string, contactId: string, version?: number) =>
  (await o.getStatus(noticeId, version)).rows.find((r) => r.contact_id === contactId)!;

// 1. Start the emergency notice for three residents
const started = await o.startNotice("notice_002", 1, ["contact_a", "contact_b", "contact_c"]);
assert.equal(started.outreach.filter((x) => x.status === "started").length, 3);
const again = await o.startNotice("notice_002", 1, ["contact_a"]);
assert.equal(again.outreach[0].status, "already_started", "double-click must not call twice");
const [oa, ob, oc] = started.outreach.map((x) => x.outreach_id!);
assert.equal((await row("notice_002", "contact_a")).contact_status, "in_progress");

// 2. A confirms, B needs help in Spanish, C doesn't answer
await o.simulateCall(oa, "confirmed");
await o.simulateCall(ob, "needs_assistance");
await o.simulateCall(oc, "no_answer");
let a = await row("notice_002", "contact_a");
let b = await row("notice_002", "contact_b");
let c = await row("notice_002", "contact_c");
assert.equal(a.contact_status, "acknowledged");
assert.equal(a.assistance_status, "none");
assert.equal(a.acknowledged_version, 1);
assert.equal(b.contact_status, "acknowledged");
assert.equal(b.assistance_status, "requested");
assert.equal(b.needs_transport, true);
assert.equal(b.preferred_language, "es");
assert.equal(c.contact_status, "not_reached");
assert.equal(c.last_channel, "sms", "no answer should fall back to SMS");
assert.equal(c.attempt_count, 2);

// 3. Duplicate webhook is ignored
const db0 = await readDb();
const callA = db0.attempts.find((x) => x.outreach_id === oa && x.channel === "voice")!;
const dup = await o.handleRetellEvent({ event: "call_analyzed", call: { call_id: callA.retell_call_id } });
assert.ok("duplicate" in dup);

// 4. C texts back "2" -> needs help
await o.simulateInboundSms("contact_c", "2");
c = await row("notice_002", "contact_c");
assert.equal(c.contact_status, "acknowledged");
assert.equal(c.assistance_status, "requested");

// 5. Only a coordinator closes a case
await o.setAssistance(ob, "closed", "Accessible van booked for 4 PM");
b = await row("notice_002", "contact_b");
assert.equal(b.assistance_status, "closed");

// 6. Twist: notice replaced -> v2. A reply to the old question gets flagged, not assumed.
await o.replaceNotice("notice_002", {
  expected_version: 1,
  title: "Evacuation order (simulated)",
  body_en: "Leave now. Buses at the north entrance.",
  body_es: "Salga ahora. Autobuses en la entrada norte.",
  change_note: "Twist: warning became an order",
});
await assert.rejects(o.replaceNotice("notice_002", { expected_version: 1, title: "x", body_en: "x", body_es: "x" }), /version 2/);
const v2 = await o.startNotice("notice_002", 2, ["contact_a", "contact_b", "contact_c"]);
assert.equal(v2.outreach.length, 3);

// 7. Network outage: calls and texts fail honestly, household stays visible
await o.setNetworkFailure(true);
const ov2c = v2.outreach.find((x) => x.contact_id === "contact_c")!.outreach_id!;
await o.simulateCall(ov2c, "no_answer").catch(() => null); // ringing call from before the outage
await o.retryOutreach(ov2c, "voice");
c = await row("notice_002", "contact_c", 2);
assert.equal(c.contact_status, "not_reached");
assert.equal(c.last_failure_reason, "network_down");
await o.setNetworkFailure(false);

// 8. v1 board still shows who heard v1
a = await row("notice_002", "contact_a", 1);
assert.equal(a.acknowledged_version, 1);

// 9. STOP opts out everywhere
await o.simulateInboundSms("contact_a", "STOP");
const dbs = await readDb();
assert.equal(dbs.contacts.find((x) => x.id === "contact_a")!.opted_out, true);
await assert.rejects(o.retryOutreach(oa, "voice"), /opted out/);

// 10. Unrecognized reply is flagged for review
const ob2 = v2.outreach.find((x) => x.contact_id === "contact_b")!.outreach_id!;
await o.simulateCall(ob2, "hung_up"); // picked up, said nothing -> SMS fallback
await o.simulateInboundSms("contact_b", "maybe later?");
b = await row("notice_002", "contact_b", 2);
assert.equal(b.needs_review, true);
assert.equal(b.review_reason, "unrecognized_reply");

// 11. Report + follow-up list
const rep = await o.getReport("notice_002");
assert.ok(rep.total >= 6);
const fu = await o.getFollowupList("notice_002", 2);
assert.ok(fu.rows.some((r) => r.contact_id === "contact_c"));

// 12. Retell signature check matches the documented algorithm
const key = "key_test";
const raw = JSON.stringify({ event: "call_ended", call: { call_id: "x" } });
const ts = String(Date.now());
const sig = `v=${ts},d=${crypto.createHmac("sha256", key).update(raw + ts).digest("hex")}`;
assert.equal(verifyRetellSignature(raw, sig, key), true);
assert.equal(verifyRetellSignature(raw + " ", sig, key), false);
assert.equal(verifyRetellSignature(raw, `v=${Number(ts) - 6 * 60 * 1000},d=00`, key), false);

// 13. Unapproved notices can't be sent
const draft = await o.createNotice({ title: "Draft", body_en: "x", body_es: "x", mode: "routine", approved: false });
await assert.rejects(o.startNotice(draft.id, 1, ["contact_b"]), /approved/);

console.log("All logic checks passed ✔");
console.log(JSON.stringify(rep, null, 2));
fs.rmSync(".data/smoke-test.json", { force: true });

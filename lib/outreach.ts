import { config, smsProvider, voiceProvider } from "./config";
import { createPhoneCall, LANGUAGE_NAMES, mapDisconnection } from "./retell";
import { parseReply, sendSms, smsText } from "./sms";
import { mutate, readDb } from "./store";
import type {
  AssistanceStatus,
  Attempt,
  Contact,
  DashboardResponse,
  DashboardRow,
  DB,
  InboundMessage,
  Lang,
  Notice,
  NoticeMode,
  Outreach,
} from "./types";
import { HttpError, nextId, nowIso, toBool, toText } from "./util";

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
const getNotice = (db: DB, id: string) => {
  const n = db.notices.find((x) => x.id === id);
  if (!n) throw new HttpError(404, `Notice ${id} does not exist.`);
  return n;
};
const getOutreach = (db: DB, id: string) => {
  const o = db.outreach.find((x) => x.id === id);
  if (!o) throw new HttpError(404, `Outreach ${id} does not exist.`);
  return o;
};
const getContact = (db: DB, id: string) => db.contacts.find((c) => c.id === id)!;
const versionOf = (n: Notice, v: number) => n.versions.find((x) => x.version === v);
const attemptsFor = (db: DB, o: Outreach) =>
  o.attempt_ids.map((id) => db.attempts.find((a) => a.id === id)!).filter(Boolean);
const touch = (o: Outreach) => (o.updated_at = nowIso());

function optOut(db: DB, c: Contact) {
  c.opted_out = true;
  c.active_sms_outreach_id = null;
  // Past acknowledgments stay true; opting out only stops future contact.
  for (const o of db.outreach.filter((x) => x.contact_id === c.id && !x.cancelled && x.contact_status !== "acknowledged")) {
    o.contact_status = "opted_out";
    o.next_retry_at = null;
    touch(o);
  }
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------
export async function listNotices() {
  const db = await readDb();
  return db.notices.map((n) => ({
    ...n,
    versions: n.versions.map((v) => ({
      ...v,
      outreach_count: db.outreach.filter((o) => o.notice_id === n.id && o.notice_version === v.version).length,
    })),
  }));
}

export async function listContacts() {
  const db = await readDb();
  return db.contacts.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    preferred_language: c.preferred_language,
    address: c.address,
    opted_out: c.opted_out,
    phone_hint: `••• ${c.phone.slice(-4)}`,
  }));
}

interface NoticeInput {
  title?: string;
  body_en?: string;
  body_es?: string;
  mode?: NoticeMode;
  approved?: boolean;
  simulated?: boolean;
  change_note?: string;
}

function cleanBody(input: NoticeInput) {
  const title = (input.title ?? "").trim();
  const en = (input.body_en ?? "").trim();
  const es = (input.body_es ?? "").trim();
  if (!title) throw new HttpError(422, "Add a title for the notice.");
  if (!en || !es) throw new HttpError(422, "Add the notice text in both English and Spanish.");
  return { title, body: { en, es } as Record<Lang, string> };
}

export async function createNotice(input: NoticeInput) {
  const { title, body } = cleanBody(input);
  return mutate((db) => {
    const t = nowIso();
    const n: Notice = {
      id: nextId(db, "notice"),
      mode: input.mode === "emergency" ? "emergency" : "routine",
      status: "active",
      approved: input.approved === true,
      simulated: input.simulated !== false,
      region: "us-la",
      current_version: 1,
      versions: [{ version: 1, title, body, change_note: null, created_at: t }],
      created_at: t,
      updated_at: t,
    };
    db.notices.push(n);
    return n;
  });
}

// Replace = new version. Calls already in progress finish on the old version;
// acknowledged_version records which version each person actually heard.
export async function replaceNotice(id: string, input: NoticeInput & { expected_version?: number }) {
  const { title, body } = cleanBody(input);
  return mutate((db) => {
    const n = getNotice(db, id);
    if (n.status === "cancelled") throw new HttpError(409, "This notice was cancelled. Create a new notice instead.");
    if (input.expected_version !== n.current_version)
      throw new HttpError(409, `Notice is at version ${n.current_version}, not ${input.expected_version}. Reload and try again.`);
    const v = n.current_version + 1;
    n.versions.push({ version: v, title, body, change_note: input.change_note?.trim() || null, created_at: nowIso() });
    n.current_version = v;
    if (typeof input.approved === "boolean") n.approved = input.approved;
    n.updated_at = nowIso();
    return n;
  });
}

export async function cancelNotice(id: string) {
  return mutate((db) => {
    const n = getNotice(db, id);
    n.status = "cancelled";
    n.updated_at = nowIso();
    for (const o of db.outreach.filter((x) => x.notice_id === id)) {
      o.cancelled = true;
      o.next_retry_at = null;
      touch(o);
      for (const c of db.contacts) if (c.active_sms_outreach_id === o.id) c.active_sms_outreach_id = null;
    }
    return n;
  });
}

// ---------------------------------------------------------------------------
// Starting outreach + dialing
// ---------------------------------------------------------------------------
export async function startNotice(id: string, version: number, contactIds: string[]) {
  if (!Array.isArray(contactIds) || contactIds.length === 0) throw new HttpError(422, "Pick at least one contact.");

  const plan = await mutate((db) => {
    const n = getNotice(db, id);
    if (n.status === "cancelled") throw new HttpError(409, "This notice was cancelled.");
    if (!n.approved) throw new HttpError(422, "Only approved notices can be sent. Mark the notice as approved first.");
    if (version !== n.current_version)
      throw new HttpError(409, `Notice is at version ${n.current_version}. Send the current version.`);

    const results: { contact_id: string; outreach_id: string | null; status: string }[] = [];
    const toDial: string[] = [];
    for (const cid of contactIds) {
      const c = db.contacts.find((x) => x.id === cid);
      if (!c) {
        results.push({ contact_id: cid, outreach_id: null, status: "unknown_contact" });
        continue;
      }
      if (c.opted_out) {
        results.push({ contact_id: cid, outreach_id: null, status: "opted_out" });
        continue;
      }
      // Idempotent: a double-click never calls the same person twice for the same version.
      const existing = db.outreach.find(
        (o) => o.notice_id === id && o.notice_version === version && o.contact_id === cid && !o.cancelled
      );
      if (existing) {
        results.push({ contact_id: cid, outreach_id: existing.id, status: "already_started" });
        continue;
      }
      const t = nowIso();
      const o: Outreach = {
        id: nextId(db, "outreach"),
        notice_id: id,
        notice_version: version,
        contact_id: cid,
        contact_status: "pending",
        assistance_status: null,
        understood: null,
        needs_transport: null,
        mobility_needs: null,
        callback_requested: null,
        needs_confirmed: null,
        acknowledged_version: null,
        acknowledged_at: null,
        needs_review: false,
        review_reason: null,
        coordinator_notes: [],
        call_summary: null,
        attempt_ids: [],
        next_retry_at: null,
        cancelled: false,
        created_at: t,
        updated_at: t,
      };
      db.outreach.push(o);
      const a = newAttempt(db, o, "voice");
      toDial.push(a.id);
      results.push({ contact_id: cid, outreach_id: o.id, status: "started" });
    }
    return { results, toDial };
  });

  // Retell's default limit is 1 call start per second, so stagger real calls.
  for (const [i, attemptId] of plan.toDial.entries()) {
    if (i > 0 && voiceProvider() === "retell") await new Promise((r) => setTimeout(r, 1100));
    await dialAttempt(attemptId);
  }
  return { notice_id: id, version, outreach: plan.results };
}

function newAttempt(db: DB, o: Outreach, channel: "voice" | "sms"): Attempt {
  const a: Attempt = {
    id: nextId(db, "attempt"),
    outreach_id: o.id,
    contact_id: o.contact_id,
    notice_id: o.notice_id,
    notice_version: o.notice_version,
    channel,
    retell_call_id: null,
    provider_message_id: null,
    is_simulated: false,
    started_at: nowIso(),
    ended_at: null,
    delivery_status: "queued",
    failure_reason: null,
  };
  db.attempts.push(a);
  o.attempt_ids.push(a.id);
  touch(o);
  return a;
}

async function dialAttempt(attemptId: string) {
  const db = await readDb();
  const a = db.attempts.find((x) => x.id === attemptId)!;
  const o = getOutreach(db, a.outreach_id);
  const c = getContact(db, a.contact_id);
  const n = getNotice(db, a.notice_id);
  const v = versionOf(n, a.notice_version)!;

  if (db.settings.network_failure) {
    await failAttempt(attemptId, "network_down");
    return fallbackToSms(o.id);
  }

  if (voiceProvider() === "simulated") {
    // No Retell keys: the call "rings" until someone resolves it from the demo controls.
    await mutate((d) => {
      const x = d.attempts.find((y) => y.id === attemptId)!;
      x.is_simulated = true;
      x.retell_call_id = `sim_call_${x.id}`;
      x.delivery_status = "ringing";
      const oo = getOutreach(d, x.outreach_id);
      if (oo.contact_status === "pending" || oo.contact_status === "not_reached") oo.contact_status = "in_progress";
      touch(oo);
    });
    return;
  }

  try {
    const call = await createPhoneCall({
      to: c.phone,
      lang: c.preferred_language,
      attemptId,
      metadata: { attempt_id: a.id, outreach_id: o.id, notice_id: n.id, notice_version: a.notice_version },
      variables: {
        organization_name: config.orgName,
        resident_name: c.display_name,
        preferred_language: LANGUAGE_NAMES[c.preferred_language],
        notice_title: v.title,
        notice_body: v.body[c.preferred_language],
        is_simulated: n.simulated ? "true" : "false",
      },
    });
    await mutate((d) => {
      const x = d.attempts.find((y) => y.id === attemptId)!;
      x.retell_call_id = call.call_id;
      x.delivery_status = "ringing";
      const oo = getOutreach(d, x.outreach_id);
      if (oo.contact_status === "pending" || oo.contact_status === "not_reached") oo.contact_status = "in_progress";
      touch(oo);
    });
  } catch (err) {
    console.error(err);
    await failAttempt(attemptId, "provider_error");
    await fallbackToSms(o.id);
  }
}

async function failAttempt(attemptId: string, reason: string) {
  await mutate((d) => {
    const x = d.attempts.find((y) => y.id === attemptId)!;
    x.delivery_status = "failed";
    x.failure_reason = reason;
    x.ended_at = nowIso();
    const o = getOutreach(d, x.outreach_id);
    if (o.contact_status !== "acknowledged" && o.contact_status !== "opted_out") o.contact_status = "not_reached";
    touch(o);
  });
}

// One SMS fallback per outreach, and only one open SMS question per contact.
async function fallbackToSms(outreachId: string, manual = false) {
  const plan = await mutate((db) => {
    const o = getOutreach(db, outreachId);
    const c = getContact(db, o.contact_id);
    if (o.cancelled || c.opted_out) return null;
    if (!manual && o.contact_status === "acknowledged") return null;
    if (!manual && attemptsFor(db, o).some((a) => a.channel === "sms")) return null;
    const n = getNotice(db, o.notice_id);
    const v = versionOf(n, o.notice_version)!;
    const a = newAttempt(db, o, "sms");
    if (c.active_sms_outreach_id && c.active_sms_outreach_id !== o.id) {
      // Replacing someone's open question: their next reply could refer to either notice.
      c.replaced_open_question = true;
    }
    c.active_sms_outreach_id = o.id;
    return {
      attemptId: a.id,
      to: c.phone,
      text: smsText(c.preferred_language, v.title, v.body[c.preferred_language], n.simulated),
      networkDown: db.settings.network_failure,
    };
  });
  if (!plan) return;

  if (plan.networkDown) return failAttempt(plan.attemptId, "network_down");
  try {
    const sent = await sendSms(plan.to, plan.text);
    await mutate((d) => {
      const x = d.attempts.find((y) => y.id === plan.attemptId)!;
      x.provider_message_id = sent.provider_message_id;
      x.is_simulated = sent.simulated;
      x.delivery_status = "completed"; // sent; the person still has to reply
      x.ended_at = nowIso();
      const o = getOutreach(d, x.outreach_id);
      if (o.contact_status !== "acknowledged" && o.contact_status !== "opted_out") o.contact_status = "not_reached";
      touch(o);
    });
  } catch (err) {
    console.error(err);
    await failAttempt(plan.attemptId, "provider_error");
  }
}

export async function retryOutreach(id: string, channel: "voice" | "sms") {
  if (channel === "sms") {
    await mutate((db) => {
      const o = getOutreach(db, id);
      const c = getContact(db, o.contact_id);
      if (o.cancelled) throw new HttpError(409, "This notice was cancelled.");
      if (c.opted_out) throw new HttpError(409, "This resident opted out. Do not contact them again.");
    });
    await fallbackToSms(id, true);
    return (await readDb()).outreach.find((o) => o.id === id);
  }
  const attemptId = await mutate((db) => {
    const o = getOutreach(db, id);
    const c = getContact(db, o.contact_id);
    if (o.cancelled) throw new HttpError(409, "This notice was cancelled.");
    if (c.opted_out) throw new HttpError(409, "This resident opted out. Do not contact them again.");
    const busy = attemptsFor(db, o).some((a) => a.channel === "voice" && (a.delivery_status === "queued" || a.delivery_status === "ringing"));
    if (busy) throw new HttpError(409, "A call to this resident is already in progress.");
    return newAttempt(db, o, "voice").id;
  });
  await dialAttempt(attemptId);
  return (await readDb()).outreach.find((o) => o.id === id);
}

// ---------------------------------------------------------------------------
// Retell webhook events (real or simulated go through the same path)
// ---------------------------------------------------------------------------
export async function handleRetellEvent(payload: any) {
  const event: string = payload?.event;
  const call = payload?.call;
  if (!call?.call_id || !event) return { ignored: "missing event or call" };

  const result = await mutate((db) => {
    const key = `${call.call_id}:${event}`;
    if (db.processed_events.includes(key)) return { duplicate: true } as const;
    db.processed_events.push(key);
    if (db.processed_events.length > 3000) db.processed_events = db.processed_events.slice(-2000);

    const a =
      db.attempts.find((x) => x.retell_call_id === call.call_id) ??
      db.attempts.find((x) => x.id === call.metadata?.attempt_id);
    if (!a) return { ignored: "call is not part of an outreach (e.g. a website demo call)" } as const;
    a.retell_call_id = a.retell_call_id ?? call.call_id;
    const o = getOutreach(db, a.outreach_id);
    const c = getContact(db, a.contact_id);
    let needFallback = false;

    if (event === "call_started") {
      a.delivery_status = "ringing";
      if (o.contact_status === "pending") o.contact_status = "in_progress";
    } else if (event === "call_ended" || event === "call_analyzed") {
      const analysis = event === "call_analyzed" ? call.call_analysis ?? {} : null;
      const m = mapDisconnection(call.disconnection_reason, analysis?.in_voicemail);
      a.delivery_status = m.delivery_status;
      a.failure_reason = m.failure_reason;
      a.ended_at = call.end_timestamp ? new Date(call.end_timestamp).toISOString() : a.ended_at ?? nowIso();

      if (call.disconnection_reason === "user_requested_dnc") {
        optOut(db, c);
      } else if (m.delivery_status !== "completed") {
        if (o.contact_status !== "acknowledged" && o.contact_status !== "opted_out") o.contact_status = "not_reached";
        needFallback = true;
      } else if (analysis) {
        const engaged = applyAnalysis(db, o, a, c, analysis);
        if (!engaged && o.contact_status !== "acknowledged" && o.contact_status !== "opted_out") {
          o.contact_status = "not_reached";
          a.failure_reason = "no_response";
          needFallback = true;
        }
      }
    }
    touch(o);
    return { outreach_id: o.id, needFallback } as const;
  });

  if ("needFallback" in result && result.needFallback) await fallbackToSms(result.outreach_id);
  return result;
}

// Returns true if the person actually engaged with the questions.
function applyAnalysis(db: DB, o: Outreach, a: Attempt, c: Contact, analysis: any): boolean {
  const d = analysis?.custom_analysis_data ?? {};
  if (toBool(d.opted_out) === true) {
    optOut(db, c);
    return true;
  }
  const understood = toBool(d.understood);
  const needsAssistance = toBool(d.needs_assistance);
  if (understood === null && needsAssistance === null) return false;

  const transport = toBool(d.needs_transport);
  const mobility = toText(d.mobility_needs);
  const callback = toBool(d.callback_requested);

  o.understood = understood;
  o.needs_transport = transport;
  o.mobility_needs = mobility;
  o.callback_requested = callback;
  o.needs_confirmed = toBool(d.needs_confirmed);
  o.call_summary = typeof analysis.call_summary === "string" ? analysis.call_summary : o.call_summary;
  o.contact_status = "acknowledged";
  o.acknowledged_version = a.notice_version;
  o.acknowledged_at = o.acknowledged_at ?? nowIso();

  const wantsHelp = needsAssistance === true || transport === true || callback === true || !!mobility || understood === false;
  o.assistance_status = nextAssistance(o.assistance_status, wantsHelp, needsAssistance === false);

  if (understood === false) flag(o, "did_not_understand");
  else if (wantsHelp && o.needs_confirmed === false) flag(o, "needs_not_confirmed_on_call");
  return true;
}

function nextAssistance(current: AssistanceStatus, wantsHelp: boolean, saidNo: boolean): AssistanceStatus {
  if (wantsHelp) return current === "in_progress" ? "in_progress" : "requested";
  if (saidNo && current === null) return "none";
  return current;
}

const flag = (o: Outreach, reason: string) => {
  o.needs_review = true;
  o.review_reason = reason;
};

// ---------------------------------------------------------------------------
// Inbound SMS replies
// ---------------------------------------------------------------------------
export async function handleInboundSms(input: {
  provider_message_id: string;
  from_number: string;
  body: string;
  received_at?: string;
  is_simulated: boolean;
}) {
  return mutate((db) => {
    if (db.messages.some((m) => m.provider_message_id === input.provider_message_id)) return { duplicate: true };
    const msg: InboundMessage = {
      provider_message_id: input.provider_message_id,
      outreach_id: null,
      from_number: input.from_number,
      body: input.body,
      received_at: input.received_at ?? nowIso(),
      is_simulated: input.is_simulated,
      parsed_choice: parseReply(input.body),
      match_status: "unmatched",
    };
    db.messages.push(msg);

    const c = db.contacts.find((x) => x.phone === input.from_number);
    if (!c) return msg;

    const latest = db.outreach.filter((o) => o.contact_id === c.id).sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
    if (msg.parsed_choice === "stop") {
      msg.outreach_id = c.active_sms_outreach_id ?? latest?.id ?? null;
      msg.match_status = "opted_out";
      optOut(db, c);
      return msg;
    }

    let o = c.active_sms_outreach_id ? db.outreach.find((x) => x.id === c.active_sms_outreach_id) : undefined;
    let review: string | null = null;
    if (!o) {
      o = latest;
      review = "reply_without_open_question";
    }
    if (!o) return msg;
    msg.outreach_id = o.id;

    const n = getNotice(db, o.notice_id);
    if (!review && (o.cancelled || n.status === "cancelled")) review = "reply_after_notice_cancelled";
    if (!review && n.current_version !== o.notice_version) review = "reply_may_refer_to_old_notice";
    if (!review && c.replaced_open_question) review = "reply_may_refer_to_old_notice";
    if (!review && msg.parsed_choice === null) review = "unrecognized_reply";
    c.replaced_open_question = false;

    if (review) {
      flag(o, review);
      msg.match_status = "needs_review";
      touch(o);
      return msg;
    }

    o.understood = true;
    o.contact_status = "acknowledged";
    o.acknowledged_version = o.notice_version;
    o.acknowledged_at = o.acknowledged_at ?? nowIso();
    o.assistance_status = nextAssistance(o.assistance_status, msg.parsed_choice === "2", msg.parsed_choice === "1");
    c.active_sms_outreach_id = null;
    msg.match_status = "matched";
    touch(o);
    return msg;
  });
}

// ---------------------------------------------------------------------------
// Coordinator actions (a human is the only one who can close a case)
// ---------------------------------------------------------------------------
export async function setAssistance(id: string, status: AssistanceStatus, note?: string) {
  if (!["requested", "in_progress", "closed"].includes(status as string))
    throw new HttpError(422, "assistance_status must be requested, in_progress, or closed.");
  return mutate((db) => {
    const o = getOutreach(db, id);
    o.assistance_status = status;
    if (note?.trim()) o.coordinator_notes.push({ at: nowIso(), text: note.trim() });
    touch(o);
    return o;
  });
}

export async function resolveReview(id: string, note?: string) {
  return mutate((db) => {
    const o = getOutreach(db, id);
    o.needs_review = false;
    o.coordinator_notes.push({ at: nowIso(), text: `Review cleared (${o.review_reason ?? "flag"})${note?.trim() ? `: ${note.trim()}` : ""}` });
    o.review_reason = null;
    touch(o);
    return o;
  });
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------
function rowFor(db: DB, o: Outreach): DashboardRow {
  const c = getContact(db, o.contact_id);
  const atts = attemptsFor(db, o).sort((x, y) => (x.started_at < y.started_at ? -1 : 1));
  const last = atts[atts.length - 1] ?? null;
  return {
    outreach_id: o.id,
    contact_id: c.id,
    display_name: c.display_name,
    preferred_language: c.preferred_language,
    contact_status: o.contact_status,
    assistance_status: o.assistance_status,
    understood: o.understood,
    needs_transport: o.needs_transport,
    mobility_needs: o.mobility_needs,
    callback_requested: o.callback_requested,
    needs_confirmed: o.needs_confirmed,
    acknowledged_version: o.acknowledged_version,
    last_channel: last?.channel ?? null,
    last_delivery_status: last?.delivery_status ?? null,
    last_failure_reason: last?.failure_reason ?? null,
    needs_review: o.needs_review,
    review_reason: o.review_reason,
    is_simulated: atts.some((a) => a.is_simulated),
    attempt_count: atts.length,
    next_retry_at: o.next_retry_at,
    coordinator_notes: o.coordinator_notes,
    updated_at: o.updated_at,
  };
}

export async function getStatus(id: string, version?: number): Promise<DashboardResponse> {
  const db = await readDb();
  const n = getNotice(db, id);
  const v = version ?? n.current_version;
  const nv = versionOf(n, v);
  if (!nv) throw new HttpError(404, `Notice ${id} has no version ${v}.`);
  return {
    notice: {
      id: n.id,
      version: v,
      current_version: n.current_version,
      title: nv.title,
      mode: n.mode,
      status: n.status,
      simulated: n.simulated,
      region: n.region,
    },
    rows: db.outreach.filter((o) => o.notice_id === id && o.notice_version === v).map((o) => rowFor(db, o)),
    refreshed_at: nowIso(),
    meta: {
      network_failure: db.settings.network_failure,
      demo_mode: config.demoMode,
      voice_provider: voiceProvider(),
      sms_provider: smsProvider(),
    },
  };
}

export async function getOutreachDetail(id: string) {
  const db = await readDb();
  const o = getOutreach(db, id);
  return {
    outreach: o,
    row: rowFor(db, o),
    attempts: attemptsFor(db, o),
    responses: db.messages.filter((m) => m.outreach_id === id),
  };
}

// Twist 1 build piece: the numbers a funder or a city buyer would ask for.
export async function getReport(id: string, version?: number) {
  const db = await readDb();
  const n = getNotice(db, id);
  const list = db.outreach.filter((o) => o.notice_id === id && (version ? o.notice_version === version : true));
  const acked = list.filter((o) => o.contact_status === "acknowledged");
  const secs = acked
    .filter((o) => o.acknowledged_at)
    .map((o) => (Date.parse(o.acknowledged_at!) - Date.parse(o.created_at)) / 1000)
    .sort((x, y) => x - y);
  const median = secs.length ? secs[Math.floor((secs.length - 1) / 2)] : null;
  const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
  const notReached = list.filter((o) => o.contact_status === "not_reached");
  return {
    notice_id: n.id,
    version: version ?? "all",
    simulated: n.simulated,
    total: list.length,
    acknowledged: acked.length,
    reach_rate: list.length ? Math.round((acked.length / list.length) * 100) / 100 : null,
    median_seconds_to_acknowledge: median === null ? null : Math.round(median),
    assistance_requested: list.filter((o) => o.assistance_status === "requested" || o.assistance_status === "in_progress").length,
    assistance_closed: list.filter((o) => o.assistance_status === "closed").length,
    not_reached: notReached.length,
    opted_out: list.filter((o) => o.contact_status === "opted_out").length,
    needs_review: list.filter((o) => o.needs_review).length,
    languages: count(list.map((o) => getContact(db, o.contact_id).preferred_language)),
    channels_used: count(list.flatMap((o) => attemptsFor(db, o).map((a) => a.channel))),
    not_reached_reasons: count(
      notReached.map((o) => {
        const atts = attemptsFor(db, o);
        return atts[atts.length - 1]?.failure_reason ?? (atts.length ? "awaiting_reply" : "not_attempted");
      })
    ),
  };
}

// The door-knock list: who to follow up with in person when phones don't work.
export async function getFollowupList(id: string, version?: number) {
  const db = await readDb();
  const n = getNotice(db, id);
  const v = version ?? n.current_version;
  const nv = versionOf(n, v);
  const rows = db.outreach
    .filter((o) => o.notice_id === id && o.notice_version === v && !o.cancelled)
    .filter(
      (o) =>
        o.contact_status === "not_reached" ||
        o.contact_status === "in_progress" ||
        o.contact_status === "pending" ||
        o.assistance_status === "requested" ||
        o.assistance_status === "in_progress" ||
        o.needs_review
    )
    .map((o) => {
      const c = getContact(db, o.contact_id);
      const r = rowFor(db, o);
      return { ...r, address: c.address, phone: c.phone };
    });
  return { notice: { id: n.id, version: v, title: nv?.title ?? "", simulated: n.simulated }, generated_at: nowIso(), rows };
}

// ---------------------------------------------------------------------------
// Demo controls (only reachable when DEMO_MODE=true)
// ---------------------------------------------------------------------------
export async function setNetworkFailure(enabled: boolean) {
  return mutate((db) => {
    db.settings.network_failure = enabled;
    return db.settings;
  });
}

const SIM_OUTCOMES: Record<string, { reason: string; inVoicemail?: boolean; data?: Record<string, unknown>; summary?: string }> = {
  confirmed: {
    reason: "agent_hangup",
    data: { understood: true, needs_assistance: false, needs_confirmed: true },
    summary: "Resident confirmed they understood the notice and can follow it on their own.",
  },
  needs_assistance: {
    reason: "agent_hangup",
    data: {
      understood: true,
      needs_assistance: true,
      needs_transport: true,
      mobility_needs: "Household member uses a wheelchair",
      callback_requested: true,
      needs_confirmed: true,
    },
    summary: "Resident understood but has no car; their mother uses a wheelchair. Needs were read back and confirmed.",
  },
  no_answer: { reason: "dial_no_answer" },
  voicemail: { reason: "voicemail_reached", inVoicemail: true },
  hung_up: { reason: "user_hangup", data: {} },
  opt_out: { reason: "user_requested_dnc" },
};

export async function simulateCall(outreachId: string, outcome: string) {
  const sim = SIM_OUTCOMES[outcome];
  if (!sim) throw new HttpError(422, `Unknown outcome. Use one of: ${Object.keys(SIM_OUTCOMES).join(", ")}.`);
  const db = await readDb();
  const o = getOutreach(db, outreachId);
  const a = attemptsFor(db, o)
    .filter((x) => x.channel === "voice" && (x.delivery_status === "ringing" || x.delivery_status === "queued"))
    .pop();
  if (!a) throw new HttpError(409, "No call is ringing for this resident. Use “Call again” first.");
  const call = {
    call_id: a.retell_call_id ?? `sim_call_${a.id}`,
    metadata: { attempt_id: a.id },
    disconnection_reason: sim.reason,
    end_timestamp: Date.now(),
    call_analysis: { in_voicemail: !!sim.inVoicemail, call_summary: sim.summary, custom_analysis_data: sim.data ?? {} },
  };
  await handleRetellEvent({ event: "call_ended", call });
  await handleRetellEvent({ event: "call_analyzed", call });
  return getOutreachDetail(outreachId);
}

export async function simulateInboundSms(contactId: string, body: string) {
  const db = await readDb();
  const c = db.contacts.find((x) => x.id === contactId);
  if (!c) throw new HttpError(404, `Contact ${contactId} does not exist.`);
  return handleInboundSms({
    provider_message_id: `sim_in_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    from_number: c.phone,
    body,
    is_simulated: true,
  });
}

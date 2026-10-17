"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/BrandMark";
import { api, describe, LANG_LABEL, laneOf, needsOf, REVIEW, timePT, type Lane } from "@/components/client-lib";
import type { DashboardResponse, DashboardRow, Notice } from "@/lib/types";

type NoticeWithCounts = Notice & { versions: (Notice["versions"][number] & { outreach_count: number })[] };
type ContactLite = { id: string; display_name: string; preferred_language: "en" | "es"; address: string | null; opted_out: boolean; phone_hint: string };

const LANES: { id: Lane; title: string; note: string }[] = [
  { id: "help", title: "Needs a person", note: "Asked for help or needs a human check" },
  { id: "miss", title: "Not reached", note: "Follow up another way" },
  { id: "wait", title: "In progress", note: "Calls and texts still out" },
  { id: "ok", title: "Heard it", note: "Heard the notice. That doesn’t mean they’re safe." },
];

export default function Dashboard() {
  const [notices, setNotices] = useState<NoticeWithCounts[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [noticeId, setNoticeId] = useState<string>("");
  const [version, setVersion] = useState<number>(0);
  const [status, setStatus] = useState<DashboardResponse | null>(null);
  const [report, setReport] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [bodyLang, setBodyLang] = useState<"en" | "es">("en");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const notice = notices.find((n) => n.id === noticeId);
  const shownVersion = notice?.versions.find((v) => v.version === version);
  const viewingCurrent = notice ? version === notice.current_version : false;

  const say = (text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), 4200);
  };

  const loadLists = useCallback(async (keepSelection = true) => {
    const [n, c] = await Promise.all([api<{ notices: NoticeWithCounts[] }>("/api/notices"), api<{ contacts: ContactLite[] }>("/api/contacts")]);
    setNotices(n.notices);
    setContacts(c.contacts);
    if (!keepSelection || !n.notices.some((x) => x.id === noticeId)) {
      const first = n.notices.find((x) => x.mode === "emergency" && x.status === "active") ?? n.notices[0];
      if (first) {
        setNoticeId(first.id);
        setVersion(first.current_version);
      }
    }
    setPicked((p) => (p.length ? p : c.contacts.filter((x) => !x.opted_out).map((x) => x.id)));
  }, [noticeId]);

  const loadStatus = useCallback(async () => {
    if (!noticeId || !version) return;
    try {
      const [s, r] = await Promise.all([
        api<DashboardResponse>(`/api/notices/${noticeId}/status?version=${version}`),
        api(`/api/notices/${noticeId}/report?version=${version}`),
      ]);
      setStatus(s);
      setReport(r);
    } catch (e: any) {
      say(e.message, true);
    }
  }, [noticeId, version]);

  useEffect(() => {
    loadLists(false).catch((e) => say(e.message, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStatus();
    const t = window.setInterval(loadStatus, 2500);
    return () => window.clearInterval(t);
  }, [loadStatus]);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await fn();
      if (done) say(done);
      await Promise.all([loadStatus(), loadLists()]);
    } catch (e: any) {
      say(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const g: Record<Lane, DashboardRow[]> = { help: [], miss: [], wait: [], ok: [] };
    for (const r of status?.rows ?? []) g[laneOf(r)].push(r);
    return g;
  }, [status]);

  const demo = status?.meta.demo_mode ?? false;
  const networkDown = status?.meta.network_failure ?? false;

  return (
    <div className="dash">
      <header className="topbar">
        <Brand />
        <label className="sr-only" htmlFor="notice-pick">
          Notice
        </label>
        <select
          id="notice-pick"
          value={noticeId}
          onChange={(e) => {
            const n = notices.find((x) => x.id === e.target.value);
            setNoticeId(e.target.value);
            setVersion(n?.current_version ?? 1);
            setStatus(null);
          }}
        >
          {notices.map((n) => (
            <option key={n.id} value={n.id}>
              {n.versions[n.versions.length - 1].title}
              {n.status === "cancelled" ? " (cancelled)" : ""}
            </option>
          ))}
        </select>
        {notice && notice.versions.length > 1 && (
          <div className="versions" role="group" aria-label="Notice version">
            {notice.versions.map((v) => (
              <button key={v.version} type="button" aria-pressed={v.version === version} onClick={() => setVersion(v.version)}>
                v{v.version}
              </button>
            ))}
          </div>
        )}
        <span className={`netpill ${networkDown ? "down" : ""}`}>{networkDown ? "Simulated network outage" : "Network normal"}</span>
        <span className="spacer" />
        {status && (
          <span className="hint">
            Calls: {status.meta.voice_provider === "retell" ? "Retell" : "simulated"}. Texts: {status.meta.sms_provider === "twilio" ? "Twilio" : "simulated"}.
          </span>
        )}
        <button
          className="btn quiet small"
          type="button"
          onClick={async () => {
            await fetch("/api/login", { method: "DELETE" });
            window.location.href = "/login";
          }}
        >
          Sign out
        </button>
      </header>

      <div className="dash-body">
        <aside className="side">
          {notice && shownVersion && (
            <section>
              <h2>Notice</h2>
              <p className="notice-title">{shownVersion.title}</p>
              <div className="notice-meta">
                <span className={`mode ${notice.mode}`}>{notice.mode === "emergency" ? "Emergency" : "Routine"}</span>
                <span className="hint">
                  Version {shownVersion.version} of {notice.current_version}
                  {notice.simulated ? ", simulated" : ""}
                  {notice.approved ? ", approved" : ", not approved yet"}
                </span>
              </div>
              <div className="lang-toggle" role="group" aria-label="Notice language">
                <button type="button" aria-pressed={bodyLang === "en"} onClick={() => setBodyLang("en")}>
                  English
                </button>
                <button type="button" aria-pressed={bodyLang === "es"} onClick={() => setBodyLang("es")}>
                  Español
                </button>
              </div>
              <p className="notice-text" lang={bodyLang}>
                {shownVersion.body[bodyLang]}
              </p>
              {shownVersion.change_note && <p className="hint">What changed: {shownVersion.change_note}</p>}
            </section>
          )}

          {notice && notice.status === "active" && (
            <section>
              <h2>Send to residents</h2>
              {viewingCurrent ? (
                <>
                  <div className="contact-pick">
                    {contacts.map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          disabled={c.opted_out}
                          checked={picked.includes(c.id) && !c.opted_out}
                          onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))}
                        />
                        <span>
                          {c.display_name} <span className="hint">({LANG_LABEL[c.preferred_language]})</span>
                          <small>{c.opted_out ? "Asked not to be contacted" : `${c.address ?? "No address"}, phone ${c.phone_hint}`}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="stack">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy || !notice.approved || picked.length === 0}
                      onClick={() =>
                        act(
                          () => api(`/api/notices/${notice.id}/start`, { body: { version, contact_ids: picked } }),
                          `Calling ${picked.length} resident${picked.length === 1 ? "" : "s"} with version ${version}.`
                        )
                      }
                    >
                      Call {picked.length} resident{picked.length === 1 ? "" : "s"}
                    </button>
                    {!notice.approved && <p className="hint">Only approved notices can be sent.</p>}
                  </div>
                </>
              ) : (
                <p className="hint">
                  You’re looking at version {version}.{" "}
                  <button className="btn quiet small" type="button" onClick={() => setVersion(notice.current_version)}>
                    Go to version {notice.current_version}
                  </button>
                </p>
              )}
            </section>
          )}

          {notice && notice.status === "active" && shownVersion && (
            <details>
              <summary>Update this notice</summary>
              <EditNotice
                key={`${notice.id}-${notice.current_version}`}
                notice={notice}
                busy={busy}
                onSave={(form) =>
                  act(async () => {
                    const r = await api<{ notice: Notice }>(`/api/notices/${notice.id}/replace`, {
                      body: { ...form, expected_version: notice.current_version },
                    });
                    setVersion(r.notice.current_version);
                  }, "Saved as a new version. Send it so residents hear the update.")
                }
              />
              <div className="stack">
                <button
                  className="btn danger small"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Cancel this notice? Queued retries stop and late replies get flagged for review.")) {
                      act(() => api(`/api/notices/${notice.id}/cancel`, { body: {} }), "Notice cancelled.");
                    }
                  }}
                >
                  Cancel notice
                </button>
              </div>
            </details>
          )}

          <details>
            <summary>New notice</summary>
            <NewNotice
              busy={busy}
              onSave={(form) =>
                act(async () => {
                  const r = await api<{ notice: Notice }>(`/api/notices`, { body: form });
                  setNoticeId(r.notice.id);
                  setVersion(1);
                }, "Notice saved.")
              }
            />
          </details>

          {notice && (
            <section>
              <h2>Follow-up list</h2>
              <div className="row-actions">
                <a className="btn quiet small" href={`/dashboard/followup?notice=${notice.id}&version=${version}`} target="_blank" rel="noreferrer">
                  Open printable list
                </a>
                <a className="btn quiet small" href={`/api/notices/${notice.id}/followup?version=${version}&format=csv`}>
                  Download CSV
                </a>
              </div>
            </section>
          )}

          {demo && (
            <details open>
              <summary>Demo controls</summary>
              <div className="stack">
                <button
                  className={`btn small ${networkDown ? "" : "danger"}`}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api("/api/sim/network-failure", { body: { enabled: !networkDown } }),
                      networkDown ? "Network restored." : "Simulated outage on. New calls and texts will fail."
                    )
                  }
                >
                  {networkDown ? "Restore the network" : "Simulate a network outage"}
                </button>
                <button
                  className="btn quiet small"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Reset all demo data? Every call, text and notice change will be erased.")) {
                      act(async () => {
                        await api("/api/sim/reset", { body: {} });
                        await loadLists(false);
                      }, "Demo data reset.");
                    }
                  }}
                >
                  Reset demo data
                </button>
                <p className="hint">Each card also gets buttons to play out the call or a text reply.</p>
              </div>
            </details>
          )}
        </aside>

        <main className="main">
          <div className="board-head">
            <h1>{shownVersion ? `${shownVersion.title}, version ${version}` : "Loading"}</h1>
            {status && <p className="hint">Updated {timePT(status.refreshed_at)}</p>}
          </div>

          {report && report.total > 0 && (
            <dl className="report">
              <div>
                <dt>Heard it</dt>
                <dd>
                  {report.acknowledged} of {report.total}
                </dd>
              </div>
              <div>
                <dt>Needs help</dt>
                <dd>{report.assistance_requested}</dd>
              </div>
              <div>
                <dt>Not reached</dt>
                <dd>{report.not_reached + report.opted_out}</dd>
              </div>
              <div>
                <dt>Median time to hear it</dt>
                <dd>{report.median_seconds_to_acknowledge === null ? "None yet" : formatSecs(report.median_seconds_to_acknowledge)}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>{Object.entries(report.languages).map(([k, v]) => `${LANG_LABEL[k] ?? k} ${v}`).join(", ")}</dd>
              </div>
            </dl>
          )}

          {status && status.rows.length === 0 && (
            <p className="lane-empty">
              Nobody has been contacted with this version yet. Pick residents on the left and start the calls.
            </p>
          )}

          {status &&
            status.rows.length > 0 &&
            LANES.map((lane) => (
              <section key={lane.id} className={`lane ${lane.id}`} aria-labelledby={`lane-${lane.id}`}>
                <div className="lane-head">
                  <h2 id={`lane-${lane.id}`}>{lane.title}</h2>
                  <span className="count">{grouped[lane.id].length}</span>
                  <p>{lane.note}</p>
                </div>
                {grouped[lane.id].length === 0 && <p className="lane-empty">Nobody here right now.</p>}
                {grouped[lane.id].map((r) => (
                  <Person key={r.outreach_id} row={r} lane={lane.id} demo={demo} busy={busy} act={act} />
                ))}
              </section>
            ))}
        </main>
      </div>

      {toast && (
        <div className={`toast ${toast.bad ? "bad" : ""}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function formatSecs(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function Person({
  row: r,
  lane,
  demo,
  busy,
  act,
}: {
  row: DashboardRow;
  lane: Lane;
  demo: boolean;
  busy: boolean;
  act: (fn: () => Promise<unknown>, done?: string) => Promise<void>;
}) {
  const needs = needsOf(r);
  const ringing = r.contact_status === "in_progress" && r.last_channel === "voice" && r.last_delivery_status === "ringing";
  const canRetry = r.contact_status !== "opted_out" && !ringing;
  const id = r.outreach_id;

  const setAssist = (s: "in_progress" | "closed", label: string) => {
    const note = window.prompt(s === "closed" ? "What was done? (saved on the case)" : "Note for the team (optional)") ?? "";
    act(() => api(`/api/outreach/${id}/assistance`, { method: "PATCH", body: { assistance_status: s, note } }), label);
  };

  return (
    <article className="person">
      <div>
        <h3>
          {r.display_name}
          <span className="lang" title="Preferred language">
            {LANG_LABEL[r.preferred_language]}
          </span>
          {r.is_simulated && <span className="sim">simulated</span>}
        </h3>
        <p className="line">{describe(r)}</p>
        {needs.length > 0 && (
          <ul className="needs" aria-label="Needs">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {r.needs_review && <p className="flag">Check this: {REVIEW[r.review_reason ?? ""] ?? r.review_reason}</p>}
        {r.coordinator_notes.length > 0 && <p className="notes">Note: {r.coordinator_notes[r.coordinator_notes.length - 1].text}</p>}
      </div>

      <div className="actions">
        {lane === "help" && r.assistance_status === "requested" && (
          <button className="btn small" type="button" disabled={busy} onClick={() => setAssist("in_progress", "Marked as in progress.")}>
            Mark in progress
          </button>
        )}
        {(r.assistance_status === "requested" || r.assistance_status === "in_progress") && (
          <button className="btn quiet small" type="button" disabled={busy} onClick={() => setAssist("closed", "Case closed.")}>
            Close case
          </button>
        )}
        {r.needs_review && (
          <button
            className="btn quiet small"
            type="button"
            disabled={busy}
            onClick={() => act(() => api(`/api/outreach/${id}/review`, { body: { note: "" } }), "Flag cleared.")}
          >
            Clear flag
          </button>
        )}
        {(lane === "miss" || lane === "wait") && canRetry && (
          <>
            <button className="btn quiet small" type="button" disabled={busy} onClick={() => act(() => api(`/api/outreach/${id}/retry`, { body: { channel: "voice" } }), "Calling again.")}>
              Call again
            </button>
            <button className="btn quiet small" type="button" disabled={busy} onClick={() => act(() => api(`/api/outreach/${id}/retry`, { body: { channel: "sms" } }), "Text sent.")}>
              Text again
            </button>
          </>
        )}
      </div>

      {demo && r.contact_status !== "opted_out" && ((ringing && r.is_simulated) || r.last_channel === "sms") && (
        <div className="demo">
          {ringing && r.is_simulated ? (
            <>
              <span>Play out this call:</span>
              {[
                ["confirmed", "Confirms"],
                ["needs_assistance", "Needs help"],
                ["no_answer", "No answer"],
                ["voicemail", "Voicemail"],
                ["hung_up", "Hangs up"],
              ].map(([outcome, label]) => (
                <button key={outcome} className="btn quiet small" type="button" disabled={busy} onClick={() => act(() => api("/api/sim/call", { body: { outreach_id: id, outcome } }))}>
                  {label}
                </button>
              ))}
            </>
          ) : r.last_channel === "sms" ? (
            <>
              <span>Resident texts back:</span>
              {["1", "2", "STOP"].map((b) => (
                <button key={b} className="btn quiet small" type="button" disabled={busy} onClick={() => act(() => api("/api/sim/sms", { body: { contact_id: r.contact_id, body: b } }))}>
                  {b}
                </button>
              ))}
            </>
          ) : null}
        </div>
      )}
    </article>
  );
}

function NoticeFields({ initial, prefix }: { initial?: { title: string; en: string; es: string }; prefix: string }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-title`}>Title</label>
        <input id={`${prefix}-title`} name="title" defaultValue={initial?.title} required />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-en`}>English text</label>
        <textarea id={`${prefix}-en`} name="body_en" defaultValue={initial?.en} required />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-es`}>Spanish text</label>
        <textarea id={`${prefix}-es`} name="body_es" defaultValue={initial?.es} required lang="es" />
      </div>
    </>
  );
}

function EditNotice({ notice, busy, onSave }: { notice: NoticeWithCounts; busy: boolean; onSave: (f: any) => void }) {
  const cur = notice.versions.find((v) => v.version === notice.current_version)!;
  return (
    <div
      className="stack"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <NoticeFields prefix="edit" initial={{ title: cur.title, en: cur.body.en, es: cur.body.es }} />
      <div className="field">
        <label htmlFor="f-change">What changed</label>
        <input id="f-change" name="change_note" placeholder="For example: warning became an order" />
      </div>
      <button
        className="btn small"
        type="button"
        disabled={busy}
        onClick={(e) => {
          const box = (e.currentTarget.parentElement as HTMLElement)!;
          const val = (n: string) => (box.querySelector(`[name="${n}"]`) as HTMLInputElement).value;
          onSave({ title: val("title"), body_en: val("body_en"), body_es: val("body_es"), change_note: val("change_note") });
        }}
      >
        Save as version {notice.current_version + 1}
      </button>
    </div>
  );
}

function NewNotice({ busy, onSave }: { busy: boolean; onSave: (f: any) => void }) {
  return (
    <div className="stack">
      <NoticeFields prefix="new" />
      <div className="field">
        <label htmlFor="f-mode">Type</label>
        <select id="f-mode" name="mode" defaultValue="emergency">
          <option value="routine">Routine (everyday building notice)</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" name="approved" style={{ width: 18, height: 18, marginTop: 4 }} />
        <span>This text was approved by the issuing authority</span>
      </label>
      <button
        className="btn small"
        type="button"
        disabled={busy}
        onClick={(e) => {
          const box = (e.currentTarget.parentElement as HTMLElement)!;
          const el = (n: string) => box.querySelector(`[name="${n}"]`) as HTMLInputElement;
          onSave({
            title: el("title").value,
            body_en: el("body_en").value,
            body_es: el("body_es").value,
            mode: el("mode").value,
            approved: el("approved").checked,
            simulated: true,
          });
        }}
      >
        Save notice
      </button>
    </div>
  );
}

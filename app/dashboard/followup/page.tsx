"use client";
import { useEffect, useState } from "react";
import { Brand } from "@/components/BrandMark";
import { api, describe, LANG_LABEL, needsOf, REVIEW, timePT } from "@/components/client-lib";

// The door-knock list: everyone who wasn't reached, needs help, or needs a human check.
// Works on paper when the phones don't.
export default function Followup() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("notice");
    const v = q.get("version");
    if (!id) return setError("Open this page from the dashboard.");
    api(`/api/notices/${id}/followup${v ? `?version=${v}` : ""}`).then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="followup"><p className="error-text">{error}</p></main>;
  if (!data) return <main className="followup"><p className="hint">Loading the list.</p></main>;

  return (
    <main className="followup">
      <div className="board-head">
        <Brand />
        <button className="btn no-print" type="button" onClick={() => window.print()}>
          Print list
        </button>
      </div>
      <h1 style={{ marginBottom: 4 }}>Follow-up list: {data.notice.title}, version {data.notice.version}</h1>
      <p className="hint">
        Made {timePT(data.generated_at)}. {data.rows.length} household{data.rows.length === 1 ? "" : "s"} to check in person or by phone.
        {data.notice.simulated ? " Simulated notice." : ""}
      </p>
      {data.rows.length === 0 ? (
        <p>Everyone on this notice heard it and nobody asked for help.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Done</th>
                <th>Resident</th>
                <th>Where</th>
                <th>Why they’re on this list</th>
                <th>Needs</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.outreach_id}>
                  <td><div className="check" aria-hidden="true" /></td>
                  <td>
                    <strong>{r.display_name}</strong>
                    <br />
                    <span className="hint">{LANG_LABEL[r.preferred_language]}, {r.phone}</span>
                  </td>
                  <td>{r.address ?? "No address on file"}</td>
                  <td>
                    {describe(r)}
                    {r.needs_review && <><br /><span className="error-text">{REVIEW[r.review_reason] ?? r.review_reason}</span></>}
                  </td>
                  <td>{needsOf(r).join(", ") || "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

"use client";
import { useRef, useState } from "react";

// Talk to the REACH agent from the browser (Retell web call). No phone number involved,
// so guests on the demo floor can try it. Needs NEXT_PUBLIC_RETELL_PUBLIC_KEY and the agent IDs.
const KEY = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "";
const AGENTS: Record<"en" | "es", string> = {
  en: process.env.NEXT_PUBLIC_RETELL_WEB_AGENT_ID_EN ?? "",
  es: process.env.NEXT_PUBLIC_RETELL_WEB_AGENT_ID_ES ?? "",
};

const DEMO_NOTICE = {
  en: {
    title: "Evacuation warning (simulated)",
    body: "This is a simulated evacuation warning for Building B. Residents should prepare to leave within two hours. Bring medications, ID, and phone chargers. If you cannot leave on your own, or someone in your home needs help moving, tell us now.",
  },
  es: {
    title: "Advertencia de evacuación (simulacro)",
    body: "Esta es una advertencia de evacuación simulada para el Edificio B. Los residentes deben prepararse para salir dentro de dos horas. Traiga sus medicamentos, identificación y cargadores de teléfono. Si no puede salir por su cuenta, o si alguien en su hogar necesita ayuda para moverse, díganoslo ahora.",
  },
};

export function TryCall() {
  const [lang, setLang] = useState<"en" | "es">("en");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [error, setError] = useState("");
  const callRef = useRef<any>(null);
  const configured = Boolean(KEY && AGENTS[lang]);

  async function start() {
    setError("");
    setStatus("connecting");
    try {
      const { RetellClient } = await import("retell-client-js-sdk");
      const client = new RetellClient({ key: KEY });
      callRef.current = client.createWebCall({
        agent_id: AGENTS[lang],
        retell_llm_dynamic_variables: {
          organization_name: "Building B Resident Services",
          resident_name: lang === "es" ? "vecino" : "neighbor",
          preferred_language: lang === "es" ? "Spanish" : "English",
          notice_title: DEMO_NOTICE[lang].title,
          notice_body: DEMO_NOTICE[lang].body,
          is_simulated: "true",
        },
        metadata: { source: "website_demo" },
        hooks: {
          onStatus: (s: string) => setStatus(s === "live" ? "live" : s === "ended" ? "ended" : "connecting"),
          onEnd: () => setStatus((s) => (s === "error" ? s : "ended")),
          onError: (e: Error) => {
            setError(e?.message || "The call could not start. Check microphone permission.");
            setStatus("error");
          },
        },
      });
    } catch (e: any) {
      setError(e?.message || "The call could not start.");
      setStatus("error");
    }
  }

  async function stop() {
    await callRef.current?.end?.();
    setStatus("ended");
  }

  const live = status === "connecting" || status === "live";
  return (
    <div className="trycall">
      <div className="lang-toggle" role="group" aria-label="Call language">
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} disabled={live}>
          English
        </button>
        <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")} disabled={live}>
          Español
        </button>
      </div>
      {live ? (
        <button className="btn danger" type="button" onClick={stop}>
          End call
        </button>
      ) : (
        <button className="btn signal" type="button" onClick={start} disabled={!configured}>
          {lang === "es" ? "Pruebe la llamada" : "Try the call in your browser"}
        </button>
      )}
      <span className="state" role="status" aria-live="polite">
        {!configured && "Browser calls turn on once the Retell public key is set."}
        {status === "connecting" && "Connecting. Allow your microphone."}
        {status === "live" && "You're live. Answer like a resident would."}
        {status === "ended" && "Call ended."}
        {status === "error" && <span className="error-text">{error}</span>}
      </span>
    </div>
  );
}

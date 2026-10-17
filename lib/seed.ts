import fs from "fs";
import path from "path";
import type { Contact, DB, Lang, Notice } from "./types";
import { isE164, nowIso } from "./util";

// Real, consented test numbers go in CONTACTS_JSON (env) or data/contacts.json (gitignored).
// The example file uses fake 555 numbers so nothing real ever ends up in git.
function loadContacts(): Contact[] {
  let raw: any[] | null = null;
  if (process.env.CONTACTS_JSON) {
    raw = JSON.parse(process.env.CONTACTS_JSON);
  } else {
    for (const f of ["data/contacts.json", "data/contacts.example.json"]) {
      const p = path.join(process.cwd(), f);
      if (fs.existsSync(p)) {
        raw = JSON.parse(fs.readFileSync(p, "utf8"));
        break;
      }
    }
  }
  if (!Array.isArray(raw)) throw new Error("No contacts found. Add data/contacts.json or set CONTACTS_JSON.");
  return raw.map((c, i) => {
    const phone = String(c.phone ?? "").trim();
    if (!isE164(phone)) throw new Error(`Contact ${c.id ?? i} has a phone that is not E.164: "${phone}"`);
    const lang: Lang = c.preferred_language === "es" ? "es" : "en";
    return {
      id: String(c.id ?? `contact_${i + 1}`),
      display_name: String(c.display_name ?? `Resident ${i + 1}`),
      phone,
      preferred_language: lang,
      address: c.address ? String(c.address) : null,
      opted_out: false,
      active_sms_outreach_id: null,
    };
  });
}

function seedNotices(): Notice[] {
  const t = nowIso();
  return [
    {
      id: "notice_001",
      mode: "routine",
      status: "active",
      approved: true,
      simulated: true,
      region: "us-la",
      current_version: 1,
      created_at: t,
      updated_at: t,
      versions: [
        {
          version: 1,
          title: "Elevator maintenance",
          change_note: null,
          created_at: t,
          body: {
            en: "Elevator B will be out of service on Tuesday from 9 AM to 3 PM for maintenance. If you need help with stairs or deliveries during that time, tell us now and building staff will follow up.",
            es: "El elevador B estará fuera de servicio el martes de 9 a. m. a 3 p. m. por mantenimiento. Si necesita ayuda con las escaleras o con entregas durante ese tiempo, díganos ahora y el personal del edificio le dará seguimiento.",
          },
        },
      ],
    },
    {
      id: "notice_002",
      mode: "emergency",
      status: "active",
      approved: true,
      simulated: true,
      region: "us-la",
      current_version: 1,
      created_at: t,
      updated_at: t,
      versions: [
        {
          version: 1,
          title: "Evacuation warning (simulated)",
          change_note: null,
          created_at: t,
          body: {
            en: "This is a simulated evacuation warning for Building B. Residents should prepare to leave within two hours. Bring medications, ID, and phone chargers. If you cannot leave on your own, or someone in your home needs help moving, tell us now.",
            es: "Esta es una advertencia de evacuación simulada para el Edificio B. Los residentes deben prepararse para salir dentro de dos horas. Traiga sus medicamentos, identificación y cargadores de teléfono. Si no puede salir por su cuenta, o si alguien en su hogar necesita ayuda para moverse, díganoslo ahora.",
          },
        },
      ],
    },
  ];
}

export function freshDb(): DB {
  return {
    contacts: loadContacts(),
    notices: seedNotices(),
    outreach: [],
    attempts: [],
    messages: [],
    processed_events: [],
    settings: { network_failure: false },
    counters: { notice: 2 },
  };
}

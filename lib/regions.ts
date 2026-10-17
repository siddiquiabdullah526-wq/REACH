// Twist 2 (global): everything location-specific lives here, not in the code.
// Deploying in another country = adding a region entry and agents for its languages.
export interface Region {
  id: string;
  label: string;
  timezone: string; // IANA zone used only for display; storage stays UTC
  languages: { code: string; label: string; retell_locale: string }[];
  alert_authority: string; // who issues the approved notices
  consent_rule: string; // the outbound-calling consent rule you must follow
}

export const REGIONS: Region[] = [
  {
    id: "us-la",
    label: "Los Angeles, USA",
    timezone: "America/Los_Angeles",
    languages: [
      { code: "en", label: "English", retell_locale: "en-US" },
      { code: "es", label: "Spanish", retell_locale: "es-419" },
    ],
    alert_authority: "Building management, relaying official city and county emergency orders",
    consent_rule: "TCPA: prior consent for automated calls; disclose the caller is automated",
  },
  {
    // Example only, not active in the MVP. Hindi is supported by Retell (hi-IN); Bengali is not yet.
    id: "in-odisha",
    label: "Odisha, India (example)",
    timezone: "Asia/Kolkata",
    languages: [
      { code: "hi", label: "Hindi", retell_locale: "hi-IN" },
      { code: "en", label: "English", retell_locale: "en-IN" },
    ],
    alert_authority: "State disaster management authority (cyclone and flood warnings)",
    consent_rule: "Follow national telecom rules for automated calls; verify before deploying",
  },
];

export const getRegion = (id: string) => REGIONS.find((r) => r.id === id) ?? REGIONS[0];

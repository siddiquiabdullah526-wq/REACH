// All environment configuration in one place. See .env.example.
const env = (k: string) => (process.env[k] ?? "").trim();

export const config = {
  orgName: env("ORGANIZATION_NAME") || "Building B Resident Services",
  demoMode: env("DEMO_MODE") === "true",
  dashboardPassword: env("DASHBOARD_PASSWORD"),
  sessionSecret: env("SESSION_SECRET") || "reach-dev-secret",
  databaseUrl: env("DATABASE_URL"),
  dataFile: env("DATA_FILE") || ".data/db.json",
  retell: {
    apiKey: env("RETELL_API_KEY"),
    webhookKey: env("RETELL_WEBHOOK_KEY") || env("RETELL_API_KEY"),
    skipVerify: env("RETELL_SKIP_SIGNATURE_CHECK") === "true",
    fromNumber: env("RETELL_FROM_NUMBER"),
    agentIds: { en: env("RETELL_AGENT_ID_EN"), es: env("RETELL_AGENT_ID_ES") },
    agentVersion: env("RETELL_AGENT_VERSION"), // integer, or empty = Retell uses the latest version
  },
  twilio: {
    accountSid: env("TWILIO_ACCOUNT_SID"),
    authToken: env("TWILIO_AUTH_TOKEN"),
    fromNumber: env("TWILIO_FROM_NUMBER"),
  },
};

export const voiceProvider = (): "retell" | "simulated" =>
  config.retell.apiKey && config.retell.fromNumber && config.retell.agentIds.en ? "retell" : "simulated";

export const smsProvider = (): "twilio" | "simulated" =>
  config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber ? "twilio" : "simulated";

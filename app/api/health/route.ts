import { config, smsProvider, voiceProvider } from "@/lib/config";
import { json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return json({
    ok: true,
    voice_provider: voiceProvider(),
    sms_provider: smsProvider(),
    storage: config.databaseUrl ? "postgres" : "file",
    demo_mode: config.demoMode,
    auth: Boolean(config.dashboardPassword),
  });
}

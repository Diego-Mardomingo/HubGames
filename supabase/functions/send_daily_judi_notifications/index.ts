// Aviso push diario de JUDI (cron "judi-daily-notifications-17h-spain").
// Se despliega con verify_jwt = false: la autenticación es la cabecera x-cron-secret, que se compara con el secreto
// de Vault mediante hubgames_verify_cron_secret() (solo service_role). La anon key ya no basta (#63).
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

webpush.setVapidDetails(
  "mailto:support@hubgames.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

async function isAuthorized(req: Request): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return false;
  const { data, error } = await supabase.rpc("hubgames_verify_cron_secret", { p_secret: secret });
  if (error) {
    console.error("Error verifying cron secret", error);
    return false;
  }
  return data === true;
}

// Igual que wantsType de src/lib/notification-prefs.ts: un tipo que no está en prefs cuenta como activado.
function wantsJudi(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return true;
  return (prefs as Record<string, unknown>).judi !== false;
}

// Una suscripción por dispositivo (#90): se envía a todos los dispositivos activos con «JUDI diario» encendido.
async function sendNotificationToAllEnabledUsers() {
  const { data: rows, error } = await supabase
    .from("hubgames_push_subscriptions")
    .select("id, subscription, prefs")
    .eq("enabled", true);

  if (error) {
    console.error("Error fetching push subscriptions", error);
    throw error;
  }

  const subs = (rows ?? []).filter((s) => wantsJudi(s.prefs));
  if (subs.length === 0) {
    return { sent: 0 };
  }

  const payload = JSON.stringify({
    title: "Nuevo juego JUDI disponible",
    body: "Ya puedes jugar al juego del día en HubGames.",
    url: "/judi",
  });

  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription as any, payload);
      sent++;
    } catch (err: any) {
      console.error("Error sending push to subscription", sub.id, err?.body || err?.message || err);
      // 404/410: el navegador dio de baja la suscripción; se desactiva para no reintentarla cada día.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("hubgames_push_subscriptions").update({ enabled: false }).eq("id", sub.id);
      }
    }
  }

  return { sent };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await sendNotificationToAllEnabledUsers();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send_daily_judi_notifications function", err);
    return new Response(JSON.stringify({ ok: false, error: "Failed to send notifications" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

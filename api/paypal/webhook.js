import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: true }, // PayPal sends JSON
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function paypalBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "PayPal token error");
  return data.access_token;
}

async function verifyWebhook(req) {
  // Strongly recommended verification
  const accessToken = await getPayPalAccessToken();
  const body = req.body;

  const verifyRes = await fetch(
    `${paypalBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: req.headers["paypal-auth-algo"],
        cert_url: req.headers["paypal-cert-url"],
        transmission_id: req.headers["paypal-transmission-id"],
        transmission_sig: req.headers["paypal-transmission-sig"],
        transmission_time: req.headers["paypal-transmission-time"],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: body,
      }),
    }
  );

  const out = await verifyRes.json();
  return out?.verification_status === "SUCCESS";
}

export default async function handler(req, res) {
  try {
    const ok = await verifyWebhook(req);
    if (!ok) return res.status(400).send("Invalid webhook signature");

    const event = req.body;
    const type = event.event_type;
    const resource = event.resource || {};
    const subscriptionId = resource.id || resource.billing_agreement_id;

    if (!subscriptionId) return res.status(200).json({ received: true });

    // Pull fresh PayPal subscription data
    const accessToken = await getPayPalAccessToken();
    const detailsRes = await fetch(
      `${paypalBase()}/v1/billing/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const details = await detailsRes.json();

    // Update row by paypal_subscription_id
    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: details.status || type,
        started_at: details.start_time || null,
        raw: details,
      })
      .eq("paypal_subscription_id", subscriptionId);

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


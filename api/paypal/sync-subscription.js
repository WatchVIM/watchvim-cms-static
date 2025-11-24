import { createClient } from "@supabase/supabase-js";

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

export default async function handler(req, res) {
  try {
    const { subscriptionId } = req.query;
    if (!subscriptionId)
      return res.status(400).json({ error: "Missing subscriptionId" });

    const accessToken = await getPayPalAccessToken();

    const detailsRes = await fetch(
      `${paypalBase()}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const details = await detailsRes.json();
    if (!detailsRes.ok) {
      throw new Error(details?.message || "Failed to fetch subscription");
    }

    // Find plan by paypal_plan_id
    const paypalPlanId = details.plan_id;

    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("paypal_plan_id", paypalPlanId)
      .single();

    // Update the pending row
    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: details.status,
        started_at: details.start_time || null,
        raw: details,
      })
      .eq("paypal_subscription_id", subscriptionId);

    return res.status(200).json({
      status: details.status,
      planId: plan?.id || null,
      details,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


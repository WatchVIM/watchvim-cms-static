import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

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
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: "Missing planId" });

    // --- Verify user from Supabase JWT ---
    const authHeader = req.headers.authorization || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return res.status(401).json({ error: "Missing auth token" });

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(jwt);

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid user token" });
    }
    const user = userData.user;

    // --- Get plan row from Supabase ---
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planErr || !plan) {
      return res.status(400).json({ error: "Plan not found / inactive" });
    }

    const accessToken = await getPayPalAccessToken();
    const baseUrl = getBaseUrl(req);

    const returnUrl = `${baseUrl}/account/subscribe/success`;
    const cancelUrl = `${baseUrl}/account/subscribe/cancel`;

    // --- Create PayPal subscription ---
    const createRes = await fetch(`${paypalBase()}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: plan.paypal_plan_id,
        application_context: {
          brand_name: "WatchVIM",
          user_action: "SUBSCRIBE_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
        custom_id: user.id, // helps you trace in PayPal logs
      }),
    });

    const out = await createRes.json();
    if (!createRes.ok) {
      throw new Error(out?.message || "PayPal create subscription failed");
    }

    const subId = out.id;
    const approveLink =
      (out.links || []).find((l) => l.rel === "approve")?.href || null;

    // --- Insert pending subscription in Supabase ---
    await supabaseAdmin.from("user_subscriptions").upsert({
      user_id: user.id,
      plan_id: plan.id,
      paypal_subscription_id: subId,
      status: "APPROVAL_PENDING",
      raw: out,
    });

    return res.status(200).json({
      subscriptionId: subId,
      approveUrl: approveLink,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

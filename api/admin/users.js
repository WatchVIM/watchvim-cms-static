import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: verify caller is admin
async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Missing bearer token");

  // Verify user session from token
  const supabaseUserClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: userData, error: userErr } =
    await supabaseUserClient.auth.getUser(token);

  if (userErr || !userData?.user) throw new Error("Invalid session");

  const user = userData.user;

  // Check role in profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not an admin");

  return user;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    // 1) Get all auth users
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200
    });

    if (error) throw error;

    const users = data.users || [];

    // 2) Pull subscriptions from your table
    const userIds = users.map(u => u.id);
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .in("user_id", userIds);

    // 3) Merge
    const merged = users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile: u.user_metadata || {},
      subscription: subs?.find(s => s.user_id === u.id) || null
    }));

    res.status(200).json({ users: merged });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}

#!/usr/bin/env node
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/grant-admin-super.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: user, error: userError } = await supabase
  .from("users")
  .select("id, email")
  .eq("email", email)
  .maybeSingle();

if (userError) {
  console.error("Failed to look up user:", userError.message);
  process.exit(1);
}

if (!user?.id) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

const { error: grantError } = await supabase.from("admin_role_members").upsert(
  {
    user_id: user.id,
    role_key: "admin_super",
    granted_by: user.id,
  },
  {
    onConflict: "user_id,role_key",
    ignoreDuplicates: false,
  }
);

if (grantError) {
  console.error("Failed to grant admin_super:", grantError.message);
  process.exit(1);
}

console.log(`Granted admin_super to ${email} (${user.id})`);

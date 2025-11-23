export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="pt-10">
      <h1 className="text-3xl font-bold">Profile</h1>
      <p className="mt-2 text-gray-700">Logged in as: {user.email}</p>
    </div>
  );
}

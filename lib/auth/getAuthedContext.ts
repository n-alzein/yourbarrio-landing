import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { requireSession } from "@/lib/auth/requireSession";

export async function getAuthedContext(label: string) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client unavailable");
  }
  const session = await requireSession(client, { label });
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return { client, session, userId };
}

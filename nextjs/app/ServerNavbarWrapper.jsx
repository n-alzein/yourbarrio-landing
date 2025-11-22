import { supabaseServer } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

export default async function ServerNavbarWrapper() {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  return <Navbar user={user} />;
}

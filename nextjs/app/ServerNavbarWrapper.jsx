import { supabaseServer } from "@/lib/supabase";
import NavbarClient from "@/components/NavbarClient";

export default async function ServerNavbarWrapper() {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  return <NavbarClient user={user} />;
}

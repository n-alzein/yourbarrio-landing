import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import NavbarClient from "@/components/NavbarClient";

export default async function ServerNavbarWrapper() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <NavbarClient user={user} />;
}

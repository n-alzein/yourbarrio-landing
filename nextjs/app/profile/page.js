import { supabaseServer } from "@/lib/supabase";

export default async function ProfilePage() {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl">You must be logged in.</h1>
      </div>
    );
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-4">Your Profile</h1>
      <p>Email: {user.email}</p>
      <p>ID: {user.id}</p>
    </div>
  );
}

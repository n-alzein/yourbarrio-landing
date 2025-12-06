"use client";

import Navbar from "./Navbar";

export default function NavbarClient({ user, role, loadingUser }) {
  // This component is now ONLY responsible for passing props down.
  // All auth logic happens in AuthProvider.
  return <Navbar user={user} role={role} loadingUser={loadingUser} />;
}

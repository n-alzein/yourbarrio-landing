"use client";
import { useAuth } from "@/components/AuthProvider";

export default function Test() {
  const { authUser, user, loadingUser, role } = useAuth();

  console.log("AUTH USER:", authUser);
  console.log("USER ROW:", user);
  console.log("ROLE:", role);
  console.log("loadingUser:", loadingUser);

  return <div>Check console</div>;
}

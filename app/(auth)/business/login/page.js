import { redirect } from "next/navigation";

export default function BusinessLoginAliasPage() {
  redirect("/business-auth/login?popup=1");
}

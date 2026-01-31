import { redirect } from "next/navigation";

export default function BusinessLoginLanding() {
  redirect("/business-auth/login?popup=1");
}

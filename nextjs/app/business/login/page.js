import { redirect } from "next/navigation";

export default function BusinessLoginRedirect() {
  redirect("/login?business=1");
}

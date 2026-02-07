import { requireEffectiveRole } from "@/lib/auth/requireEffectiveRole";
import BusinessOrdersClient from "./BusinessOrdersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessOrdersPage() {
  await requireEffectiveRole("business");
  return <BusinessOrdersClient />;
}

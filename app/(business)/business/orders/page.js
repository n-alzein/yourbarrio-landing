import { requireRole } from "@/lib/auth/server";
import BusinessOrdersClient from "./BusinessOrdersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessOrdersPage() {
  await requireRole("business");
  return <BusinessOrdersClient />;
}

import BusinessRegisterClient from "@/components/business-auth/BusinessRegisterClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessRegisterPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const isPopup = resolvedSearchParams?.popup === "1";
  return <BusinessRegisterClient isPopup={isPopup} />;
}

import NearbyBusinessesClient from "@/app/(customer)/customer/nearby/NearbyBusinessesClient";

export const dynamic = "force-dynamic";

export default function PublicNearbyPage() {
  return (
    <div className="pt-2">
      <NearbyBusinessesClient />
    </div>
  );
}

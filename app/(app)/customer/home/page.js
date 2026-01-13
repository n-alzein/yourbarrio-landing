import CustomerHomeClient from "./CustomerHomeClient";
import { getHomeListings } from "@/lib/home/getHomeListings.server";

export default async function CustomerHomePage() {
  const initialListings = await getHomeListings({ limit: 80 });

  return <CustomerHomeClient initialListings={initialListings} />;
}

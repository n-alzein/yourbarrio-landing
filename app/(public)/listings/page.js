import { Suspense } from "react";
import ListingsClient from "./ListingsClient";

export default function PublicListingsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <ListingsClient />
    </Suspense>
  );
}

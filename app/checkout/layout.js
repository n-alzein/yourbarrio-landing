import { Suspense } from "react";
import GlobalHeader from "@/components/nav/GlobalHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CheckoutLayout({ children }) {
  return (
    <>
      <Suspense fallback={null}>
        <GlobalHeader surface="customer" />
      </Suspense>
      <div className="pt-28 md:pt-20 min-h-screen">{children}</div>
    </>
  );
}

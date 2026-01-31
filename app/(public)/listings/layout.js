import { Suspense } from "react";
import GlobalHeader from "@/components/nav/GlobalHeader";

export default function ListingsLayout({ children }) {
  return (
    <>
      <Suspense fallback={null}>
        <GlobalHeader surface="public" />
      </Suspense>
      {children}
    </>
  );
}

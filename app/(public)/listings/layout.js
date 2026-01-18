"use client";

import GlobalHeader from "@/components/nav/GlobalHeader";

export default function ListingsLayout({ children }) {
  return (
    <>
      <GlobalHeader surface="public" />
      {children}
    </>
  );
}

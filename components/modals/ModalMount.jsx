"use client";

import dynamic from "next/dynamic";

const ModalProvider = dynamic(() => import("./ModalProviderClient"), {
  ssr: false,
});

export default function ModalMount({ children }) {
  return <ModalProvider>{children}</ModalProvider>;
}

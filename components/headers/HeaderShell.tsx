"use client";

import type { ReactNode } from "react";

type HeaderShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export default function HeaderShell({
  children,
  className = "",
  innerClassName = "",
}: HeaderShellProps) {
  return (
    <div className={`w-full px-4 sm:px-6 lg:px-10 ${className}`.trim()}>
      <div className={`mx-auto flex h-16 items-center justify-between max-w-6xl ${innerClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}

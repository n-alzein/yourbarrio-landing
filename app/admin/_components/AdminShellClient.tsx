"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import AdminMobileSidebarDrawer from "@/app/admin/_components/AdminMobileSidebarDrawer";
import AdminNavbar from "@/components/nav/AdminNavbar";

type AdminShellClientProps = {
  children: ReactNode;
  sidebarContent: ReactNode;
  statusContent?: ReactNode;
};

export default function AdminShellClient({
  children,
  sidebarContent,
  statusContent = null,
}: AdminShellClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="yb-admin-root yb-admin-shell min-h-screen bg-neutral-950 text-neutral-100 [--admin-nav-h:48px] md:[--admin-nav-h:64px]">
      <AdminNavbar onOpenMobileSidebar={() => setMobileOpen(true)} />

      <aside
        className="fixed left-0 z-[4000] hidden h-[calc(100vh-var(--admin-nav-h)-var(--yb-support-mode-offset,0px))] w-64 overflow-y-auto border-r border-neutral-900 bg-neutral-950/95 md:block top-[calc(var(--admin-nav-h)+var(--yb-support-mode-offset,0px))]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-neutral-900 px-4 py-3">
            <h2 className="text-sm font-medium tracking-wide text-neutral-200">YourBarrio Admin</h2>
          </div>
          {sidebarContent}
        </div>
      </aside>

      <div
        className="min-h-screen min-w-0 overflow-x-hidden bg-neutral-950 md:pl-64"
        style={{ paddingTop: "calc(var(--admin-nav-h) + var(--yb-support-mode-offset, 0px))" }}
      >
        <div className="mx-auto w-full max-w-7xl bg-neutral-950 px-4 pb-8 pt-3 sm:px-6 sm:pt-5 lg:px-8">
          <div className="min-h-screen min-w-0 space-y-5 bg-neutral-950">
            {statusContent}
            {children}
          </div>
        </div>
      </div>

      <AdminMobileSidebarDrawer open={mobileOpen} onOpenChange={setMobileOpen}>
        {sidebarContent}
      </AdminMobileSidebarDrawer>
    </div>
  );
}

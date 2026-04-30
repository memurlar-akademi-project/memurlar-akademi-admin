"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { AdminGate } from "@/components/app/AdminGate";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/giris";

  return (
    <AdminGate>
      {isLogin ? (
        children
      ) : (
        <div className="admin-shell-grid h-screen overflow-hidden">
          <AdminSidebar />
          <div className="min-h-0 min-w-0 overflow-hidden px-4 py-4 lg:px-6 lg:py-5">
            <div className="flex h-full min-h-0 flex-col gap-5">
              <div className="sticky top-0 z-20">
                <AdminHeader />
              </div>
              <main className="min-h-0 flex-1 overflow-y-auto pb-4 pr-1">{children}</main>
            </div>
          </div>
        </div>
      )}
    </AdminGate>
  );
}

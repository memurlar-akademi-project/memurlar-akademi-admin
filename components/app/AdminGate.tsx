"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { FullScreenSkeleton } from "@/components/ui/Skeleton";

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isBootstrapping } = useAdminAuth();

  useEffect(() => {
    if (!isBootstrapping && !session && pathname !== "/giris") {
      router.replace("/giris");
    }
  }, [isBootstrapping, pathname, router, session]);

  if (isBootstrapping) {
    return <FullScreenSkeleton />;
  }

  if (!session && pathname !== "/giris") {
    return <FullScreenSkeleton />;
  }

  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

function hasAdminSession() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${ADMIN_SESSION_COOKIE}=1`));
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }

    if (!hasAdminSession()) {
      router.replace("/admin/login");
      return;
    }

    setReady(true);
  }, [isLogin, pathname, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[image:var(--app-shell-gradient)]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-oryno-orange-muted" />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

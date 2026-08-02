"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AdminShell } from "@/components/admin/admin-shell";

type MeState = {
  session: boolean;
  isAdmin: boolean;
  canBootstrap?: boolean;
  admin?: { name: string; email: string; role: string };
};

export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(isLogin);
  const [denied, setDenied] = useState(false);
  const [me, setMe] = useState<MeState | null>(null);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      setDenied(false);
      return;
    }

    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace(`/login?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 401) {
          router.replace(`/login?redirect_url=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!data.isAdmin && !data.canBootstrap) {
          setDenied(true);
          setReady(true);
          return;
        }

        if (!data.session) {
          // Clear stale HttpOnly cookie so middleware doesn't bounce us
          try {
            await fetch("/api/admin/auth/logout", { method: "POST" });
          } catch {
            // ignore
          }
          router.replace("/admin/login");
          return;
        }

        setMe({
          session: true,
          isAdmin: true,
          admin: data.admin,
        });
        setDenied(false);
        setReady(true);
      } catch {
        if (!cancelled) {
          router.replace("/admin/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLogin, isLoaded, isSignedIn, pathname, router]);

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

  if (denied) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[image:var(--app-shell-gradient)] px-5">
        <div className="w-full max-w-md rounded-[28px] border border-border bg-background p-6 text-center shadow-[var(--shadow-lg)]">
          <p className="text-lg font-bold">Admin access denied</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have an admin role.
          </p>
          <Link
            href="/dashboard"
            className="btn-primary mt-5 inline-flex h-11 items-center px-5 text-sm"
          >
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  return <AdminShell admin={me?.admin}>{children}</AdminShell>;
}

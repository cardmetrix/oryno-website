"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OrynoRefreshIcon } from "@/components/app/oryno-refresh-icon";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const MAX_PULL = 120;

type PullToRefreshProps = {
  children: ReactNode;
  /** Custom refresh handler. Defaults to wallet invalidate + router.refresh(). */
  onRefresh?: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
};

function getScrollTop() {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/**
 * Mobile pull-to-refresh with the ORYNO branded spinner.
 * Only arms when the page is scrolled to the top; ignores mostly-horizontal swipes.
 */
export function PullToRefresh({
  children,
  onRefresh,
  className,
  disabled,
}: PullToRefreshProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const pulling = useRef(false);
  const armed = useRef(false);
  const refreshingRef = useRef(false);
  const pullRef = useRef(0);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(THRESHOLD);
    pullRef.current = THRESHOLD;
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
          Promise.resolve(router.refresh()),
        ]);
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
      pullRef.current = 0;
    }
  }, [onRefresh, queryClient, router]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 2) {
        armed.current = false;
        return;
      }
      const t = e.touches[0];
      startY.current = t.clientY;
      startX.current = t.clientX;
      pulling.current = false;
      armed.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armed.current || refreshingRef.current) return;
      if (startY.current == null || startX.current == null) return;
      if (getScrollTop() > 2) {
        armed.current = false;
        setPull(0);
        pullRef.current = 0;
        return;
      }

      const t = e.touches[0];
      const dy = t.clientY - startY.current;
      const dx = Math.abs(t.clientX - startX.current);

      if (!pulling.current && dx > dy && dx > 10) {
        armed.current = false;
        return;
      }

      if (dy <= 0) {
        pulling.current = false;
        setPull(0);
        pullRef.current = 0;
        return;
      }

      pulling.current = true;
      const resisted = Math.min(MAX_PULL, dy * 0.55);
      pullRef.current = resisted;
      setPull(resisted);

      if (dy > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      startY.current = null;
      startX.current = null;

      if (refreshingRef.current) return;

      if (pulling.current && pullRef.current >= THRESHOLD) {
        pulling.current = false;
        void runRefresh();
        return;
      }

      pulling.current = false;
      setPull(0);
      pullRef.current = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, runRefresh]);

  useEffect(() => {
    if (!refreshing) return;
    setPull((p) => Math.max(p, THRESHOLD));
  }, [refreshing]);

  const progress = Math.min(1, pull / THRESHOLD);
  const show = refreshing || pull > 4;
  const indicatorOffset = Math.min(pull, MAX_PULL);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center md:hidden"
        style={{
          height: show ? Math.max(indicatorOffset, refreshing ? 56 : 0) : 0,
          opacity: show ? 1 : 0,
          transition:
            refreshing || pull === 0
              ? "height 0.2s ease, opacity 0.2s ease"
              : undefined,
        }}
        aria-live="polite"
        aria-busy={refreshing}
      >
        <div
          className="flex items-end justify-center pb-1"
          style={{
            transform: `translateY(${Math.max(0, indicatorOffset - 48)}px)`,
            transition:
              refreshing || pull === 0 ? "transform 0.2s ease" : undefined,
          }}
        >
          <OrynoRefreshIcon
            progress={progress}
            refreshing={refreshing}
            size={44}
          />
        </div>
      </div>

      <div
        style={{
          transform:
            show && !refreshing
              ? `translateY(${indicatorOffset * 0.35}px)`
              : refreshing
                ? "translateY(18px)"
                : "translateY(0)",
          transition:
            refreshing || pull === 0
              ? "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)"
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

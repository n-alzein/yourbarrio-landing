"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import NoticeBanner from "@/components/common/NoticeBanner";
import { useAuth } from "@/components/AuthProvider";
import {
  dismissNoticeForSession,
  isNoticeDismissedForSession,
  resolveNotices,
} from "@/lib/notices/resolve-notices";

function subscribeSessionDismissal() {
  return () => {};
}

function getServerDismissalSnapshot() {
  return false;
}

function useSessionDismissedNotice(noticeId) {
  return useSyncExternalStore(
    subscribeSessionDismissal,
    () => (noticeId ? isNoticeDismissedForSession(noticeId) : false),
    getServerDismissalSnapshot
  );
}

export default function NoticeBannerHost({ audience = "all" }) {
  const pathname = usePathname() || "/";
  const { user, profile, role, authStatus } = useAuth();
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState(() => new Set());
  const [platformNotice, setPlatformNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadPlatformNotice() {
      try {
        const response = await fetch("/api/platform-announcements/active", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load announcement");
        const payload = await response.json();
        if (!cancelled) setPlatformNotice(payload?.notice || null);
      } catch {
        if (!cancelled) setPlatformNotice(null);
      }
    }

    loadPlatformNotice();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authStatus, role, user?.id]);

  const notice = useMemo(
    () =>
      resolveNotices({
        user,
        profile,
        role,
        pathname,
        extraNotices: platformNotice ? [platformNotice] : [],
      }),
    [pathname, platformNotice, profile, role, user]
  );

  const isDismissedForSession = useSessionDismissedNotice(notice?.id);

  const visible =
    authStatus !== "loading" &&
    notice &&
    (notice.audience === "all" || notice.audience === audience || audience === "all") &&
    !dismissedNoticeIds.has(notice.id) &&
    !isDismissedForSession;

  if (!visible) return null;

  return (
    <NoticeBanner
      {...notice}
      onDismiss={() => {
        dismissNoticeForSession(notice.id);
        setDismissedNoticeIds((prev) => new Set(prev).add(notice.id));
      }}
    />
  );
}

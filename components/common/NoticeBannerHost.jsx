"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import NoticeBanner from "@/components/common/NoticeBanner";
import { useAuth } from "@/components/AuthProvider";
import {
  dismissNoticeForSession,
  isNoticeDismissedForSession,
  resolveNotices,
} from "@/lib/notices/resolve-notices";

export default function NoticeBannerHost({ audience = "all" }) {
  const pathname = usePathname() || "/";
  const { user, profile, role, authStatus } = useAuth();
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState(() => new Set());

  const notice = useMemo(
    () =>
      resolveNotices({
        user,
        profile,
        role,
        pathname,
      }),
    [pathname, profile, role, user]
  );

  const visible =
    authStatus === "authenticated" &&
    notice &&
    (notice.audience === "all" || notice.audience === audience || audience === "all") &&
    !dismissedNoticeIds.has(notice.id) &&
    !isNoticeDismissedForSession(notice.id);

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

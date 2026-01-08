"use client";

import Link from "next/link";
import { getAvatarUrl, getDisplayName, getUnreadCount } from "@/lib/messages";

function formatPreviewTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboxList({
  conversations = [],
  role,
  basePath,
  loading,
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Loading messages...
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        No conversations yet. Start a message to say hello.
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-2 md:p-3">
      <div className="space-y-2">
        {conversations.map((conversation) => {
          const otherProfile =
            role === "business" ? conversation.customer : conversation.business;
          const displayName = getDisplayName(otherProfile);
          const unreadCount = getUnreadCount(conversation, role);
          const preview = conversation.last_message_preview || "";
          const previewTime = formatPreviewTime(conversation.last_message_at);

          return (
            <Link
              key={conversation.id}
              href={`${basePath}/${conversation.id}`}
              className="group block rounded-[24px] border border-transparent bg-white/0 px-4 py-4 transition hover:border-white/10 hover:bg-white/10 md:px-5 md:py-5"
            >
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarUrl(otherProfile)}
                  alt={displayName}
                  className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white/90 truncate">
                      {displayName}
                    </p>
                    <span className="text-xs text-white/50">{previewTime}</span>
                  </div>
                  <p className="text-xs text-white/60 truncate">{preview}</p>
                </div>
                {unreadCount > 0 ? (
                  <span className="min-w-[26px] rounded-full bg-rose-500/90 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white/20 opacity-0 transition group-hover:opacity-100" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

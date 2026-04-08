"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SafeAvatar from "@/components/SafeAvatar";
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
  const router = useRouter();

  const prefetchConversation = (conversationId) => {
    if (!conversationId) return;
    router.prefetch(`${basePath}/${conversationId}`);
  };

  const primeConversationIdentity = (conversation) => {
    if (typeof window === "undefined" || !conversation?.id) return;
    const otherProfile =
      role === "business" ? conversation.customer : conversation.business;
    const payload = {
      name: getDisplayName(otherProfile),
      avatarUrl: getAvatarUrl(otherProfile),
    };
    window.sessionStorage.setItem(
      `yb-conversation-header:${conversation.id}`,
      JSON.stringify(payload)
    );
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-1.5 md:p-2">
        <div className="space-y-2 p-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-white/5 bg-white/5 px-4 py-3 md:px-5 md:py-4"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 w-36 rounded-full bg-white/10" />
                    <div className="h-3 w-20 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-3 h-3 w-2/3 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
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
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-1.5 md:p-2">
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
              prefetch
              onMouseEnter={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onFocus={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onMouseDown={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onTouchStart={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              className="group block rounded-[24px] border border-transparent bg-white/0 px-4 py-3 transition hover:border-white/10 hover:bg-white/10 md:px-5 md:py-4"
            >
              <div className="flex items-center gap-4">
                <SafeAvatar
                  src={getAvatarUrl(otherProfile)}
                  name={displayName}
                  alt={displayName}
                  className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                  initialsClassName="text-[13px]"
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

"use client";

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupMessages(messages = []) {
  const groups = [];
  messages.forEach((message) => {
    const last = groups[groups.length - 1];
    if (last && last.sender_id === message.sender_id) {
      last.items.push(message);
    } else {
      groups.push({ sender_id: message.sender_id, items: [message] });
    }
  });
  return groups;
}

export default function MessageThread({
  messages = [],
  currentUserId,
  loading = false,
}) {
  if (loading && !messages.length) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, index) => {
          const isSelf = index % 2 === 0;
          return (
            <div
              key={index}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${isSelf ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-[24px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                    isSelf
                      ? "border-[#dccbff]/30 bg-[linear-gradient(135deg,rgba(220,203,255,0.28),rgba(220,203,255,0.14))]"
                      : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]"
                  }`}
                >
                  <div className="animate-pulse">
                    <div className="h-4 w-40 rounded-full bg-white/15" />
                    <div className="mt-2 h-4 w-28 rounded-full bg-white/10" />
                    {index === 2 ? (
                      <div className="mt-2 h-4 w-36 rounded-full bg-white/10" />
                    ) : null}
                  </div>
                </div>
                <div
                  className={`mt-2 h-3 rounded-full bg-white/10 animate-pulse ${
                    isSelf ? "ml-auto w-14" : "w-16"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        No messages yet. Start the conversation below.
      </div>
    );
  }

  const groups = groupMessages(messages);

  return (
    <div className="space-y-4">
      {groups.map((group, idx) => {
        const isSelf = group.sender_id === currentUserId;
        return (
          <div
            key={`${group.sender_id}-${idx}`}
            className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
              <div className="flex flex-col gap-2">
                {group.items.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isSelf
                        ? "text-slate-900"
                        : "text-slate-900"
                    }`}
                    style={{ backgroundColor: isSelf ? "#dccbff" : "#e5e7eb" }}
                  >
                    {message.body}
                  </div>
                ))}
              </div>
              <span className="mt-1 text-[11px] text-white/50">
                {formatMessageTime(group.items[group.items.length - 1]?.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

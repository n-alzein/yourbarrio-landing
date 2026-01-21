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

export default function MessageThread({ messages = [], currentUserId }) {
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

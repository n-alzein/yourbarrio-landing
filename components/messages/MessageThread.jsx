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
            <div className={`max-w-[80%] space-y-2 ${isSelf ? "items-end" : "items-start"}`}>
              {group.items.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    isSelf
                      ? "bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white"
                      : "bg-white/10 text-white/90"
                  }`}
                >
                  {message.body}
                </div>
              ))}
              <span className="text-[11px] text-white/50">
                {formatMessageTime(group.items[group.items.length - 1]?.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

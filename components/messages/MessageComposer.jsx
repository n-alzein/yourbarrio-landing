"use client";

import { useState } from "react";

export default function MessageComposer({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = value.trim().length > 0 && !sending && !disabled;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(value.trim());
      setValue("");
    } catch (err) {
      console.error("Message send failed", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write a message..."
        rows={2}
        className="flex-1 resize-none rounded-2xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!canSend}
        className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
          canSend
            ? "bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white"
            : "bg-white/10 text-white/50"
        }`}
      >
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";

export default function MessageComposer({ onSend, disabled, variant = "dark" }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const isLight = variant === "light";

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
      className={`flex items-end gap-3 rounded-3xl border ${
        isLight
          ? "border-slate-100 bg-white p-3 shadow-[0_-1px_2px_rgba(15,23,42,0.035)]"
          : "border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur"
      }`}
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write a message..."
        rows={isLight ? 1 : 2}
        className={`flex-1 resize-none rounded-2xl px-4 py-3 text-base focus:outline-none md:text-sm ${
          isLight
            ? "border border-slate-100 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus:border-violet-200 focus:bg-white"
            : "bg-white/10 text-white placeholder:text-white/50"
        }`}
      />
      <button
        type="submit"
        disabled={!canSend}
        className={`rounded-2xl px-5 text-sm font-semibold transition ${
          canSend
            ? isLight
              ? "yb-primary-button !text-white hover:!text-white focus-visible:!text-white"
              : "bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 !text-white hover:!text-white focus-visible:!text-white"
            : isLight
              ? "bg-[rgba(var(--brand-rgb),0.35)] !text-white opacity-70"
              : "bg-[rgba(var(--brand-rgb),0.35)] !text-white opacity-70"
        } ${isLight ? "py-2.5" : "py-3"}`}
      >
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}

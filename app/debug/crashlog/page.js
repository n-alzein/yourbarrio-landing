"use client";

// Enable via NEXT_PUBLIC_DEBUG_CRASHLOG=1 to render this page in production.
import { useState } from "react";
import { clearCrashLog, readCrashLog, CRASHLOG_KEY } from "@/lib/crashlog";

export default function CrashlogViewer() {
  const enabled = process.env.NEXT_PUBLIC_DEBUG_CRASHLOG === "1";
  const [entries, setEntries] = useState(() => (enabled ? readCrashLog() : []));
  const [copied, setCopied] = useState(false);

  if (!enabled) {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Crashlog viewer disabled</h1>
          <p className="text-sm text-white/70">
            Set <code className="font-mono">NEXT_PUBLIC_DEBUG_CRASHLOG=1</code> to enable{" "}
            <code className="font-mono">/debug/crashlog</code> in production. This page reads
            localStorage key <code className="font-mono">{CRASHLOG_KEY}</code>.
          </p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => setEntries(readCrashLog());

  const handleClear = () => {
    clearCrashLog();
    setEntries([]);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy crashlog", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Crashlog</h1>
            <p className="text-sm text-white/70">
              Reads recent events from <code className="font-mono">{CRASHLOG_KEY}</code>. Clear or
              copy to share. Set <code className="font-mono">NEXT_PUBLIC_DEBUG_CRASHLOG=1</code> to
              enable this page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/15 transition"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/15 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
          {entries.length ? (
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(entries, null, 2)}</pre>
          ) : (
            <div className="text-white/70">No crash entries recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

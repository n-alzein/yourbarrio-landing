"use client";

import { useMemo, useState } from "react";

type AdminUserNote = {
  id: string;
  target_user_id: string;
  actor_user_id: string;
  note: string;
  created_at: string;
};

type AdminUserNotesPanelProps = {
  userId: string;
  canAddNote: boolean;
  initialNotes: AdminUserNote[];
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminUserNotesPanel({
  userId,
  canAddNote,
  initialNotes,
}: AdminUserNotesPanelProps) {
  const [notes, setNotes] = useState<AdminUserNote[]>(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [notes]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAddNote || isSubmitting) return;

    const trimmed = noteText.trim();
    if (trimmed.length < 3 || trimmed.length > 2000) {
      setErrorMessage("Note must be between 3 and 2000 characters.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticNote: AdminUserNote = {
      id: tempId,
      target_user_id: userId,
      actor_user_id: "",
      note: trimmed,
      created_at: new Date().toISOString(),
    };

    setNotes((current) => [optimisticNote, ...current]);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/notes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ note: trimmed }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.note) {
        throw new Error(payload?.error || "Failed to add note");
      }

      const inserted = payload.note as AdminUserNote;
      setNotes((current) => [inserted, ...current.filter((item) => item.id !== tempId)]);
      setNoteText("");
    } catch (error: any) {
      setNotes((current) => current.filter((item) => item.id !== tempId));
      setErrorMessage(error?.message || "Failed to add note");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {canAddNote ? (
        <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="mb-2 font-medium">Add internal note</h3>
          <textarea
            name="note"
            required
            rows={4}
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            placeholder="Internal note"
            maxLength={2000}
            disabled={isSubmitting}
          />
          {errorMessage ? <p className="mt-2 text-sm text-rose-300">{errorMessage}</p> : null}
          <button
            type="submit"
            className="mt-2 rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save note"}
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
          You do not have permission to add notes.
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="mb-2 font-medium">Notes</h3>
        {sortedNotes.length === 0 ? (
          <p className="text-sm text-neutral-400">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {sortedNotes.map((note) => (
              <li key={note.id} className="rounded border border-neutral-800 bg-neutral-950 p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{note.note}</p>
                <p className="mt-2 text-xs text-neutral-500">{formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

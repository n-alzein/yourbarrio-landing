"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function toInputDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

export default function AnnouncementsManager({
  announcements,
  setAnnouncements,
  tone,
  businessId,
  supabase,
  onToast,
  createTrigger,
}) {
  const titleRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = useMemo(
    () => ({
      title: "",
      body: "",
      is_published: true,
      starts_at: "",
      ends_at: "",
    }),
    []
  );

  const [form, setForm] = useState(initialForm);

  const runWithTimeout = async (promise, ms, label) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out. Please try again.`));
      }, ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (!createTrigger) return;
    titleRef.current?.focus();
  }, [createTrigger]);

  const handleChange = (field) => (event) => {
    const value = field === "is_published" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      body: item.body || "",
      is_published: item.is_published ?? true,
      starts_at: toInputDate(item.starts_at),
      ends_at: toInputDate(item.ends_at),
    });
    titleRef.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      onToast?.("error", "Connection not ready. Please refresh and try again.");
      return;
    }
    if (!businessId) {
      onToast?.("error", "Business profile not ready. Refresh and try again.");
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      onToast?.("error", "Title and announcement body are required.");
      return;
    }

    const payload = {
      business_id: businessId,
      title: form.title.trim(),
      body: form.body.trim(),
      is_published: form.is_published,
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
    };

    setSaving(true);

    try {
      if (editingId) {
        const previous = announcements;
        setAnnouncements((prev) =>
          prev.map((item) =>
            item.id === editingId ? { ...item, ...payload } : item
          )
        );

        const { error } = await runWithTimeout(
          supabase
            .from("business_announcements")
            .update(payload)
            .eq("id", editingId),
          12000,
          "Update announcement"
        );

        if (error) {
          setAnnouncements(previous);
          onToast?.("error", error.message || "Failed to update announcement.");
        } else {
          onToast?.("success", "Announcement updated.");
          resetForm();
        }
      } else {
        const { data, error } = await runWithTimeout(
          supabase
            .from("business_announcements")
            .insert(payload)
            .select("*")
            .single(),
          12000,
          "Post announcement"
        );

        if (error) {
          onToast?.("error", error.message || "Failed to post announcement.");
        } else if (data) {
          setAnnouncements((prev) => [data, ...prev]);
          onToast?.("success", "Announcement posted.");
          resetForm();
        }
      }
    } catch (err) {
      onToast?.("error", err.message || "Failed to save announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!supabase) {
      onToast?.("error", "Connection not ready. Please refresh and try again.");
      return;
    }
    if (!confirm("Delete this announcement?")) return;
    const previous = announcements;
    setAnnouncements((prev) => prev.filter((item) => item.id !== id));

    const { error } = await supabase
      .from("business_announcements")
      .delete()
      .eq("id", id);

    if (error) {
      setAnnouncements(previous);
      onToast?.("error", error.message || "Failed to delete announcement.");
    } else {
      onToast?.("success", "Announcement deleted.");
    }
  };

  const handleTogglePublish = async (item) => {
    if (!supabase) {
      onToast?.("error", "Connection not ready. Please refresh and try again.");
      return;
    }
    const previous = announcements;
    const nextValue = !item.is_published;

    setAnnouncements((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, is_published: nextValue } : entry
      )
    );

    const { error } = await supabase
      .from("business_announcements")
      .update({ is_published: nextValue })
      .eq("id", item.id);

    if (error) {
      setAnnouncements(previous);
      onToast?.("error", error.message || "Failed to update publish state.");
    }
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5 md:p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${tone.textStrong}`}>Announcements</h3>
            <p className={`text-sm ${tone.textMuted}`}>Share updates, promos, and events.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`}>
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              className={`w-full rounded-xl border px-4 py-2 text-base md:text-sm focus:outline-none focus:ring-4 ${tone.input}`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`}>
              Announcement
            </label>
            <textarea
              value={form.body}
              onChange={handleChange("body")}
              rows={4}
              className={`w-full rounded-xl border px-4 py-2 text-base md:text-sm focus:outline-none focus:ring-4 ${tone.input}`}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`}>
                Starts at
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={handleChange("starts_at")}
                className={`w-full rounded-xl border px-4 py-2 text-base md:text-sm focus:outline-none focus:ring-4 ${tone.input}`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`}>
                Ends at
              </label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={handleChange("ends_at")}
                className={`w-full rounded-xl border px-4 py-2 text-base md:text-sm focus:outline-none focus:ring-4 ${tone.input}`}
              />
            </div>
          </div>
          <label className={`inline-flex items-center gap-2 text-sm ${tone.textMuted}`}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={handleChange("is_published")}
              className="h-4 w-4"
            />
            Publish immediately
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary}`}
            >
              {saving ? "Saving..." : editingId ? "Update announcement" : "Post announcement"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary}`}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {!announcements.length ? (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-6 text-center`}>
          <p className={`text-sm ${tone.textMuted}`}>No announcements yet.</p>
          <p className={`text-xs ${tone.textSoft}`}>Post a quick update to keep customers in the loop.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div key={item.id} className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-semibold ${tone.textStrong}`}>{item.title}</p>
                  <p className={`text-xs ${tone.textMuted}`}>
                    {item.starts_at ? `Starts ${new Date(item.starts_at).toLocaleDateString()}` : "No start date"}
                    {item.ends_at ? ` · Ends ${new Date(item.ends_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(item)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.buttonSecondary}`}
                  >
                    {item.is_published ? "Published" : "Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.buttonSecondary}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-rose-500 border border-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className={`mt-3 text-sm ${tone.textMuted}`}>{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

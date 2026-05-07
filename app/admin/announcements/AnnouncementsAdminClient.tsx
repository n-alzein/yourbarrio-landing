"use client";

import { useState, useTransition } from "react";
import NoticeBanner from "@/components/common/NoticeBanner";

type Announcement = {
  id: string;
  title: string | null;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  audience: "all" | "guests" | "customers" | "businesses";
  variant: "info" | "warning" | "critical";
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  status: "draft" | "active" | "archived";
  updated_at: string;
  created_at: string;
};

type FormState = {
  id?: string;
  title: string;
  message: string;
  cta_label: string;
  cta_href: string;
  audience: Announcement["audience"];
  variant: Announcement["variant"];
  priority: number;
  starts_at: string;
  ends_at: string;
  dismissible: boolean;
  status: Announcement["status"];
};

const emptyForm: FormState = {
  title: "",
  message: "",
  cta_label: "",
  cta_href: "",
  audience: "all",
  variant: "info",
  priority: 50,
  starts_at: "",
  ends_at: "",
  dismissible: true,
  status: "draft",
};

const audienceLabels = {
  all: "Everyone including guests",
  guests: "Guests only",
  customers: "Customers",
  businesses: "Businesses",
};

const statusLabels = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const statusClasses = {
  draft: "border-neutral-700 bg-neutral-800 text-neutral-200",
  active: "border-emerald-700/70 bg-emerald-950/80 text-emerald-100",
  archived: "border-amber-800/70 bg-amber-950/60 text-amber-100",
};

function sortAnnouncements(items: Announcement[]) {
  return [...items].sort((a, b) => {
    const statusWeight = { active: 0, draft: 1, archived: 2 };
    const statusDelta = statusWeight[a.status] - statusWeight[b.status];
    if (statusDelta) return statusDelta;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromAnnouncement(row: Announcement): FormState {
  return {
    id: row.id,
    title: row.title || "",
    message: row.message || "",
    cta_label: row.cta_label || "",
    cta_href: row.cta_href || "",
    audience: row.audience,
    variant: row.variant,
    priority: row.priority,
    starts_at: toDateTimeLocal(row.starts_at),
    ends_at: toDateTimeLocal(row.ends_at),
    dismissible: row.dismissible,
    status: row.status,
  };
}

function toPayload(form: FormState, status: Announcement["status"]) {
  const ctaLabel = form.cta_label.trim();
  return {
    title: form.title,
    message: form.message,
    cta_label: ctaLabel,
    cta_href: ctaLabel ? form.cta_href : null,
    audience: form.audience,
    variant: form.variant,
    priority: form.priority,
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    dismissible: form.dismissible,
    status,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scheduleSummary(row: Announcement) {
  const starts = formatDateTime(row.starts_at);
  const ends = formatDateTime(row.ends_at);
  if (starts && ends) return `${starts} – ${ends}`;
  if (starts) return `Starts ${starts}`;
  if (ends) return `Ends ${ends}`;
  return "Always on";
}

function hasTitle(row: Announcement) {
  return Boolean(String(row.title || "").trim());
}

function displayTitle(row: Announcement) {
  if (hasTitle(row)) return String(row.title).trim();
  const words = row.message.trim().split(/\s+/).filter(Boolean);
  const fallback = words.slice(0, 7).join(" ");
  return words.length > 7 ? `${fallback}...` : fallback || "Untitled announcement";
}

function StatusBadge({ status }: { status: Announcement["status"] }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const textareaClass =
  "min-h-24 w-full min-w-0 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const secondaryButtonClass =
  "h-10 rounded-md border border-neutral-700 bg-neutral-950 px-4 text-sm font-semibold text-neutral-100 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "h-10 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900 disabled:text-indigo-100/70 disabled:shadow-none";
const destructiveButtonClass =
  "h-10 rounded-md border border-red-900/70 bg-red-950/30 px-4 text-sm font-semibold text-red-100 hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const newAnnouncementButtonClass =
  "h-10 min-w-44 rounded-md border border-indigo-400/40 !bg-indigo-600 px-4 text-sm font-semibold !text-white shadow-sm shadow-indigo-950/40 transition hover:!bg-indigo-500 hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60 disabled:cursor-not-allowed disabled:!bg-indigo-900 disabled:!text-indigo-100 disabled:opacity-80 disabled:shadow-none";
const sectionClass = "min-w-0 space-y-5 rounded-lg border border-neutral-800 bg-neutral-950/45 p-5 shadow-sm shadow-black/10";
const sectionTitleClass = "text-sm font-semibold text-neutral-100";
const fieldClass = "grid gap-2 text-sm";
const validationClass = "text-xs font-medium text-amber-300";
const metaPillClass =
  "inline-flex items-center rounded-full border border-neutral-800 bg-neutral-950/70 px-2.5 py-1 text-xs font-medium text-neutral-300";

export default function AnnouncementsAdminClient({
  initialAnnouncements,
  roles,
  showInlinePageHeader = false,
}: {
  initialAnnouncements: Announcement[];
  roles: string[];
  showInlinePageHeader?: boolean;
}) {
  const canManage = roles.includes("admin_ops") || roles.includes("admin_super");
  const canDelete = roles.includes("admin_super");
  const initialSorted = sortAnnouncements(initialAnnouncements);
  const initialSelected = initialSorted[0] || null;
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected?.id || null);
  const [form, setForm] = useState<FormState>(initialSelected ? fromAnnouncement(initialSelected) : emptyForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedAnnouncements = sortAnnouncements(announcements);
  const previewMessage = form.message.trim() || "Planned maintenance tonight - YourBarrio may be briefly unavailable.";
  const isNew = !form.id;
  const messageError = form.message.trim().length === 0 ? "Message is required before publishing." : "";
  const ctaError =
    form.cta_label.trim().length > 0 && form.cta_href.trim().length === 0
      ? "Add a CTA href when a CTA label is present."
      : "";
  const ctaHrefWithoutLabelWarning =
    form.cta_label.trim().length === 0 && form.cta_href.trim().length > 0
      ? "CTA href is ignored until a CTA label is added."
      : "";
  const startsTime = form.starts_at ? new Date(form.starts_at).getTime() : null;
  const endsTime = form.ends_at ? new Date(form.ends_at).getTime() : null;
  const scheduleError =
    startsTime !== null &&
    endsTime !== null &&
    Number.isFinite(startsTime) &&
    Number.isFinite(endsTime) &&
    startsTime >= endsTime
      ? "End time must be after start time."
      : "";
  const hasValidationErrors = Boolean(messageError || ctaError || scheduleError);
  const publishDisabled = !canManage || isPending || hasValidationErrors;
  const previewCtaLabel = form.cta_label.trim();
  const previewCtaHref = previewCtaLabel && form.cta_href.trim() ? form.cta_href.trim() : undefined;

  function startNewAnnouncement() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage("");
  }

  function selectAnnouncement(row: Announcement) {
    setSelectedId(row.id);
    setForm(fromAnnouncement(row));
    setMessage("");
  }

  function saveWithStatus(status: Announcement["status"]) {
    setMessage("");
    if (form.variant === "critical" && status === "active") {
      const confirmed = window.confirm("Publish this as a critical platform announcement?");
      if (!confirmed) return;
    }

    startTransition(async () => {
      const url = form.id
        ? `/api/admin/platform-announcements/${form.id}`
        : "/api/admin/platform-announcements";
      const response = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form, status)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload?.error || "Unable to save announcement.");
        return;
      }

      const saved = payload.announcement as Announcement;
      setAnnouncements((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setForm(fromAnnouncement(saved));
      setMessage("Announcement saved.");
    });
  }

  function deleteSelected() {
    if (!form.id || !canDelete) return;
    const confirmed = window.confirm("Delete this archived announcement?");
    if (!confirmed) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/platform-announcements/${form.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload?.error || "Unable to delete announcement.");
        return;
      }
      setAnnouncements((current) => current.filter((item) => item.id !== form.id));
      const next = sortAnnouncements(announcements.filter((item) => item.id !== form.id))[0] || null;
      setSelectedId(next?.id || null);
      setForm(next ? fromAnnouncement(next) : emptyForm);
      setMessage("Announcement deleted.");
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const nextStatus = submitter?.dataset.status as Announcement["status"] | undefined;
    if (!nextStatus) return;
    saveWithStatus(nextStatus);
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] min-w-0 space-y-8">
      {showInlinePageHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-5 pb-3">
          <header className="space-y-2">
            <h2 className="text-xl font-semibold">Announcements</h2>
            <p className="text-sm text-neutral-400">
              Publish operational marketplace banners for guests, customers, and businesses.
            </p>
          </header>
          <button type="button" onClick={startNewAnnouncement} className={newAnnouncementButtonClass} disabled={!canManage || isPending}>
            + New announcement
          </button>
        </div>
      ) : null}

      <section className="min-w-0 space-y-5">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Platform banners</h3>
          <p className="text-sm text-neutral-400">Only one eligible banner appears at a time. Higher priority wins.</p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-2 shadow-sm shadow-black/10">
          {sortedAnnouncements.length ? (
            <div className="space-y-2">
              {sortedAnnouncements.map((row) => {
                const selected = selectedId === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={selected}
                    className={`group grid w-full min-w-0 gap-4 rounded-md border p-4 text-left transition hover:border-neutral-700 hover:bg-neutral-800/70 md:grid-cols-[minmax(0,1fr)_auto] ${
                      selected
                        ? "border-indigo-500/70 bg-indigo-950/35 shadow-sm shadow-indigo-950/30"
                        : "border-transparent bg-neutral-950/30"
                    }`}
                    onClick={() => selectAnnouncement(row)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral-100" title={displayTitle(row)}>
                        {displayTitle(row)}
                      </span>
                      {hasTitle(row) ? (
                        <span className="mt-1 block truncate text-sm text-neutral-400">{row.message}</span>
                      ) : (
                        <span className="mt-1 block text-xs text-neutral-500">No title</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                      <StatusBadge status={row.status} />
                      <span className={metaPillClass}>{audienceLabels[row.audience]}</span>
                      <span className={`${metaPillClass} capitalize`}>{row.variant}</span>
                      <span className={metaPillClass}>Priority {row.priority}</span>
                      <span className={metaPillClass}>{scheduleSummary(row)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <h4 className="font-semibold text-neutral-100">No announcements yet</h4>
              <p className="mx-auto mt-1 max-w-md text-sm text-neutral-400">
                Create your first platform banner for guests, customers, or businesses.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-neutral-800 bg-neutral-900/70 shadow-sm shadow-black/10">
        <form onSubmit={handleSubmit}>
          <div className="border-b border-neutral-800">
            <div className="flex w-full max-w-[1080px] items-center justify-between gap-3 px-5 py-5 sm:px-6">
              <div>
                <h3 className="font-semibold">{isNew ? "New announcement" : "Edit announcement"}</h3>
                {!canManage ? (
                  <p className="mt-1 text-sm text-amber-300">Support can view announcements. Publishing is disabled for this role.</p>
                ) : null}
              </div>
              <StatusBadge status={form.status} />
            </div>
          </div>

          <div className="w-full max-w-[1080px] space-y-6 p-5 sm:p-6">
            <section className={sectionClass}>
              <h4 className={sectionTitleClass}>Preview</h4>
              <div className="min-w-0 overflow-hidden rounded-md border border-neutral-800 bg-white text-slate-900">
                <NoticeBanner
                  id="announcement-preview"
                  variant={form.variant}
                  title={form.title}
                  message={previewMessage}
                  ctaLabel={previewCtaLabel}
                  ctaHref={previewCtaHref}
                  onCtaClick={() => {}}
                  dismissible={form.dismissible}
                  onDismiss={() => {}}
                />
              </div>
            </section>

            <section className={sectionClass}>
              <h4 className={sectionTitleClass}>Content</h4>
              <label className={fieldClass}>
                <span className="text-neutral-300">Title</span>
                <input className={inputClass} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                <span className="text-xs leading-5 text-neutral-500">
                  Optional. If blank, the message is used as the internal list label.
                </span>
              </label>
              <label className={fieldClass}>
                <span className="text-neutral-300">Message</span>
                <textarea
                  required
                  aria-invalid={Boolean(messageError)}
                  className={textareaClass}
                  maxLength={240}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                />
                {messageError ? <span className={validationClass}>{messageError}</span> : null}
              </label>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">CTA label</span>
                  <input
                    className={inputClass}
                    maxLength={40}
                    value={form.cta_label}
                    onChange={(event) => {
                      const nextLabel = event.target.value;
                      setForm({
                        ...form,
                        cta_label: nextLabel,
                        cta_href: nextLabel.trim() ? form.cta_href : "",
                      });
                    }}
                  />
                </label>
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">CTA href</span>
                  <input
                    aria-invalid={Boolean(ctaError)}
                    className={inputClass}
                    placeholder="/status"
                    value={form.cta_href}
                    onChange={(event) => setForm({ ...form, cta_href: event.target.value })}
                  />
                </label>
              </div>
              {ctaError ? <p className={validationClass}>{ctaError}</p> : null}
              {ctaHrefWithoutLabelWarning ? (
                <p className="text-xs font-medium text-neutral-400">{ctaHrefWithoutLabelWarning}</p>
              ) : null}
            </section>

            <section className={sectionClass}>
              <h4 className={sectionTitleClass}>Targeting</h4>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">Audience</span>
                  <select className={inputClass} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as Announcement["audience"] })}>
                    {Object.entries(audienceLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">Variant</span>
                  <select className={inputClass} value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value as Announcement["variant"] })}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              <label className={`${fieldClass} max-w-48 min-w-0`}>
                <span className="text-neutral-300">Priority</span>
                <input type="number" className={inputClass} value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} />
              </label>
              <p className="text-xs leading-5 text-neutral-500">Higher priority wins when multiple banners are eligible.</p>
            </section>

            <section className={sectionClass}>
              <h4 className={sectionTitleClass}>Schedule</h4>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">Starts</span>
                  <input
                    type={form.starts_at ? "datetime-local" : "text"}
                    placeholder="Optional start"
                    aria-invalid={Boolean(scheduleError)}
                    className={inputClass}
                    value={form.starts_at}
                    onFocus={(event) => {
                      event.currentTarget.type = "datetime-local";
                    }}
                    onBlur={(event) => {
                      if (!event.currentTarget.value) event.currentTarget.type = "text";
                    }}
                    onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
                  />
                </label>
                <label className={`${fieldClass} min-w-0`}>
                  <span className="text-neutral-300">Ends</span>
                  <input
                    type={form.ends_at ? "datetime-local" : "text"}
                    placeholder="Optional end"
                    aria-invalid={Boolean(scheduleError)}
                    className={inputClass}
                    value={form.ends_at}
                    onFocus={(event) => {
                      event.currentTarget.type = "datetime-local";
                    }}
                    onBlur={(event) => {
                      if (!event.currentTarget.value) event.currentTarget.type = "text";
                    }}
                    onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
                  />
                </label>
              </div>
              {scheduleError ? <p className={validationClass}>{scheduleError}</p> : null}
              <p className="text-xs leading-5 text-neutral-500">Leave both blank for an always-on banner.</p>
              <label className="inline-flex items-center gap-2 pt-1 text-sm text-neutral-300">
                <input type="checkbox" checked={form.dismissible} onChange={(event) => setForm({ ...form, dismissible: event.target.checked })} />
                Dismissible
              </label>
            </section>
          </div>

          {(message || (form.status === "draft" && publishDisabled && hasValidationErrors)) ? (
            <div className="w-full max-w-[1080px] px-5 pb-5 text-sm text-neutral-400 sm:px-6" role="status">
              <div className="rounded-md border border-neutral-800 bg-neutral-950/35 px-3 py-2">
                {message ? <p>{message}</p> : null}
                {form.status === "draft" && publishDisabled && hasValidationErrors ? (
                  <p className={validationClass}>Add a message and fix validation errors before publishing.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="border-t border-neutral-800 bg-neutral-950/30">
            <div className="flex w-full max-w-[1080px] flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
              {form.status === "draft" ? (
                <>
                  <div>
                    <button disabled={!canManage || isPending} className={destructiveButtonClass} type="submit" data-status="archived">
                      Archive
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button disabled={!canManage || isPending} className={secondaryButtonClass} type="submit" data-status="draft">
                      Save draft
                    </button>
                    <button disabled={publishDisabled} className={primaryButtonClass} type="submit" data-status="active">
                      Publish
                    </button>
                  </div>
                </>
              ) : null}
              {form.status === "active" ? (
                <>
                  <div>
                    <button disabled={!canManage || isPending} className={destructiveButtonClass} type="submit" data-status="archived">
                      Archive
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button disabled={!canManage || isPending} className={secondaryButtonClass} type="submit" data-status="draft">
                      Unpublish to draft
                    </button>
                    <button disabled={!canManage || isPending} className={primaryButtonClass} type="submit" data-status="active">
                      Save changes
                    </button>
                  </div>
                </>
              ) : null}
              {form.status === "archived" ? (
                <>
                  <div>
                    {canDelete ? (
                      <button disabled={!canManage || isPending || !form.id} className={destructiveButtonClass} type="button" onClick={deleteSelected}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button disabled={!canManage || isPending} className={secondaryButtonClass} type="submit" data-status="archived">
                      Save changes
                    </button>
                    <button disabled={!canManage || isPending} className={primaryButtonClass} type="submit" data-status="draft">
                      Restore as draft
                    </button>
                  </div>
                </>
              ) : null}
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

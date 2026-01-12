import { Megaphone } from "lucide-react";

export default function BusinessAnnouncementsPreview({ announcements }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.7)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Announcements</h2>
          <p className="text-sm text-white/70">
            Latest updates from this business.
          </p>
        </div>
      </div>

      {!announcements?.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          No announcements yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                    <Megaphone className="h-4 w-4 text-pink-300" />
                    {item.title || "Announcement"}
                  </div>
                  <p className="mt-1 text-xs text-white/60">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ""}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/70">
                  New
                </span>
              </div>
              <p className="mt-3 text-sm text-white/70 leading-relaxed line-clamp-3">
                {item.body || "Details coming soon."}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

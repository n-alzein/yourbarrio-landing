import { Clock, Globe, MapPin, Phone } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function normalizeUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

function parseHours(value) {
  if (!value) return [];
  if (typeof value === "object") {
    return DAYS.map((day) => ({ ...day, value: value[day.key] || "" })).filter(
      (entry) => entry.value
    );
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return DAYS.map((day) => ({
          ...day,
          value: parsed[day.key] || "",
        })).filter((entry) => entry.value);
      }
    } catch {}
  }
  return [];
}

export default function BusinessAbout({ profile }) {
  const hours = parseHours(profile?.hours_json);
  const addressLine = [profile?.address, profile?.city].filter(Boolean).join(", ");
  const website = profile?.website ? normalizeUrl(profile.website) : "";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.7)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-semibold">About</h2>
      </div>
      <p className="mt-4 text-sm md:text-base text-white/75 leading-relaxed">
        {profile?.description
          ? profile.description
          : "This business has not shared a detailed description yet."}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <MapPin className="h-4 w-4 text-rose-300" />
            Location & contact
          </div>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-white/40" />
              <span>{addressLine || "Address not listed yet."}</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-white/40" />
              {profile?.phone ? (
                <a className="hover:text-white" href={`tel:${profile.phone}`}>
                  {profile.phone}
                </a>
              ) : (
                <span>Phone number not listed.</span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <Globe className="mt-0.5 h-4 w-4 text-white/40" />
              {website ? (
                <a
                  className="hover:text-white"
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {profile?.website}
                </a>
              ) : (
                <span>Website not listed.</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Clock className="h-4 w-4 text-emerald-300" />
            Hours
          </div>
          {hours.length ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-white/70">
              {hours.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-white/80">{entry.label}</span>
                  <span className="text-white/70">{entry.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/70">
              Hours not listed yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

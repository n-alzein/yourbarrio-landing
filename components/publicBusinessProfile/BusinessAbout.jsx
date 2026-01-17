import {
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  Music2,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "tiktok", label: "TikTok", icon: Music2 },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "x", label: "X", icon: Twitter },
];

function normalizeUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

// Format 24h time to 12h display (e.g., "09:00" -> "9 AM", "14:30" -> "2:30 PM")
function formatTime(time24) {
  if (!time24) return "";
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const minuteDisplay = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${hour12}${minuteDisplay} ${ampm}`;
}

// Format structured hours object to display string
function formatHoursValue(dayData) {
  if (!dayData) return "";
  // Handle new structured format { open, close, isClosed }
  if (typeof dayData === "object" && dayData !== null) {
    if (dayData.isClosed) return "Closed";
    if (dayData.open && dayData.close) {
      return `${formatTime(dayData.open)} - ${formatTime(dayData.close)}`;
    }
    return "";
  }
  // Handle legacy string format
  if (typeof dayData === "string") {
    return dayData;
  }
  return "";
}

function parseHours(value) {
  if (!value) return [];
  let hoursObj = value;
  if (typeof value === "string") {
    try {
      hoursObj = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!hoursObj || typeof hoursObj !== "object") return [];

  return DAYS.map((day) => ({
    ...day,
    value: formatHoursValue(hoursObj[day.key]),
  })).filter((entry) => entry.value);
}

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default function BusinessAbout({ profile, className = "" }) {
  const hours = parseHours(profile?.hours_json);
  const addressLine = [profile?.address, profile?.city].filter(Boolean).join(", ");
  const website = profile?.website ? normalizeUrl(profile.website) : "";
  const socials = toObject(profile?.social_links_json);
  const socialLinks = SOCIAL_FIELDS.map((field) => ({
    ...field,
    href: normalizeUrl(socials?.[field.key] || ""),
  })).filter((entry) => entry.href);

  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.7)] ${className}`}
    >
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
          <div className="space-y-1 text-sm text-white/70">
            <div className="flex items-start gap-2 px-1 py-1.5">
              <MapPin className="mt-0.5 h-4 w-4 text-white/40" />
              <span>{addressLine || "Address not listed yet."}</span>
            </div>
            <div className="flex items-start gap-2 px-1 py-1.5">
              <Phone className="mt-0.5 h-4 w-4 text-white/40" />
              {profile?.phone ? (
                <a className="hover:text-white" href={`tel:${profile.phone}`}>
                  {profile.phone}
                </a>
              ) : (
                <span>Phone number not listed.</span>
              )}
            </div>
            <div className="flex items-start gap-2 px-1 py-1.5">
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
            {socialLinks.length ? (
              <div className="space-y-2 pt-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Social
                </div>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map(({ key, label, icon: Icon, href }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
                    >
                      <Icon className="h-4 w-4 text-white/50" />
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Clock className="h-4 w-4 text-emerald-300" />
            Hours
          </div>
          {hours.length ? (
            <div className="space-y-1 text-sm text-white/70">
              {hours.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-4 px-1 py-1.5"
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

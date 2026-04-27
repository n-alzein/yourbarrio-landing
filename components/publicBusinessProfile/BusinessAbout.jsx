import {
  BadgeCheck,
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
import BusinessHoursSummaryCard from "@/components/publicBusinessProfile/BusinessHoursSummaryCard";
import {
  ProfileEmptyState,
  ProfileSection,
} from "@/components/business/profile-system/ProfileSystem";
import { normalizeUrl, toObject } from "@/lib/business/profileUtils";
import { hasHoursData } from "@/lib/publicBusinessProfile/normalize";

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "tiktok", label: "TikTok", icon: Music2 },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "x", label: "X", icon: Twitter },
];

function parseCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getMapboxStaticToken() {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    ""
  );
}

function getProfileCoordinates(profile) {
  const lat = parseCoordinate(
    profile?.latitude ?? profile?.lat ?? profile?.location_lat ?? profile?.center?.lat
  );
  const lng = parseCoordinate(
    profile?.longitude ?? profile?.lng ?? profile?.location_lng ?? profile?.center?.lng
  );
  if (lat === null || lng === null) return "";
  return { lat, lng };
}

export function getStaticMapUrl(profile) {
  const token = getMapboxStaticToken();
  if (!token) return "";
  const coordinates = getProfileCoordinates(profile);
  if (!coordinates) return "";
  const overlay = `pin-l+6d3df5(${coordinates.lng},${coordinates.lat})`;
  const centeredLat = coordinates.lat + 0.00125;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${coordinates.lng},${centeredLat},14/900x320?access_token=${token}`;
}

function getWebsiteDisplay(value) {
  if (!value) return "";

  try {
    const parsed = new URL(normalizeUrl(value));
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return String(value)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/$/, "");
  }
}

function buildDirectionsUrl({ address, latitude, longitude }) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat !== null && lng !== null) {
    return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  return "";
}

function DetailRow({ icon: Icon, label, value, href, truncate = false }) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="mt-0.5 rounded-xl bg-[#faf8ff] p-1.5 text-[#6a3df0]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target={href.startsWith("tel:") ? undefined : "_blank"}
            rel={href.startsWith("tel:") ? undefined : "noreferrer"}
            title={value}
            className={`mt-1 block text-sm font-medium text-slate-900 transition hover:text-[#5b37d6] ${
              truncate ? "truncate" : "break-words"
            }`}
          >
            {value}
          </a>
        ) : (
          <p
            className={`mt-1 text-sm font-medium leading-6 text-slate-900 ${
              truncate ? "truncate" : "break-words"
            }`}
            title={truncate ? value : undefined}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function DetailsCard({ address, phone, website, websiteDisplay, category }) {
  const items = [
    address ? { key: "address", icon: MapPin, label: "Address", value: address } : null,
    phone
      ? { key: "phone", icon: Phone, label: "Phone", value: phone, href: `tel:${phone}` }
      : null,
    website
      ? {
          key: "website",
          icon: Globe,
          label: "Website",
          value: websiteDisplay || "Visit website",
          href: website,
          truncate: true,
        }
      : null,
    category
      ? { key: "category", icon: BadgeCheck, label: "Category", value: category }
      : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="rounded-[20px] border border-slate-100/70 bg-white/85 p-4 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.3)]">
      <div className="mb-1">
        <p className="text-sm font-semibold tracking-[-0.01em] text-slate-950">
          Details
        </p>
      </div>
      <div className="divide-y divide-slate-100/60">
        {items.map(({ key, ...item }) => (
          <DetailRow key={key} {...item} />
        ))}
      </div>
    </div>
  );
}

function LocationSnapshotCard({ profile, address }) {
  const mapUrl = getStaticMapUrl(profile);
  const directionsUrl = buildDirectionsUrl({
    address,
    latitude: profile?.latitude ?? profile?.lat ?? profile?.location_lat ?? profile?.center?.lat,
    longitude:
      profile?.longitude ?? profile?.lng ?? profile?.location_lng ?? profile?.center?.lng,
  });
  if (!mapUrl) return null;
  const content = (
    <div className="overflow-hidden rounded-[20px] border border-slate-100/70 bg-white/85 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.3)] transition motion-reduce:transition-none md:hover:scale-[1.005] md:hover:shadow-[0_18px_38px_-30px_rgba(15,23,42,0.34)]">
      <div className="relative h-[210px] bg-slate-100 sm:h-[218px] lg:h-[252px]">
        <img
          src={mapUrl}
          alt={address ? `Map preview for ${address}` : "Map preview"}
          data-static-map-src={process.env.NODE_ENV !== "production" ? mapUrl : undefined}
          className="h-full w-full object-cover [filter:contrast(1.04)]"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
        <div className="pointer-events-none absolute inset-0 bg-white/8" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-slate-950/9 via-slate-950/[0.015] to-transparent" />
        <div className="pointer-events-none absolute bottom-4 left-4">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/65 bg-white/68 px-2 py-0.5 text-[8.5px] font-medium text-slate-600 shadow-[0_8px_16px_-16px_rgba(15,23,42,0.28)] backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 text-[#6a3df0]" />
            Location
          </div>
        </div>
      </div>
    </div>
  );
  if (!directionsUrl) return content;
  return (
    <a
      href={directionsUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open location in maps"
      className="block"
    >
      {content}
    </a>
  );
}

export default function BusinessAbout({
  profile,
  className = "",
  headerAction = null,
  supplement = null,
}) {
  const address = [profile?.address, profile?.address_2, profile?.city, profile?.state]
    .filter(Boolean)
    .join(", ");
  const website = profile?.website ? normalizeUrl(profile.website) : "";
  const websiteDisplay = profile?.website ? getWebsiteDisplay(profile.website) : "";
  const socials = toObject(profile?.social_links_json);
  const socialLinks = SOCIAL_FIELDS.map((field) => ({
    ...field,
    href: normalizeUrl(socials?.[field.key] || ""),
  })).filter((entry) => entry.href);

  return (
    <ProfileSection
      id="about"
      hideHeader
      className={className}
    >
      <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
        <div className="min-w-0 max-w-[48rem] space-y-[0.625rem]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-[1.18rem] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[1.28rem]">
                About
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                A quick overview, contact details, and practical information.
              </p>
            </div>
            {headerAction ? <div className="shrink-0 self-start">{headerAction}</div> : null}
          </div>

          <p className="max-w-[48rem] border-l border-[#6a3df0]/20 pl-4 text-[1.06rem] leading-[2rem] text-slate-700 sm:pl-5 sm:text-[1.1rem] sm:leading-[2.08rem]">
            {profile?.description ||
              "This business has not added a full description yet."}
          </p>

          <div className="pb-5">
            <LocationSnapshotCard profile={profile} address={address} />
          </div>

          {socialLinks.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {socialLinks.map(({ key, label, icon: Icon, href }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                >
                  <Icon className="h-4 w-4 text-[#6a3df0]" />
                  {label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 lg:w-[340px] lg:shrink-0">
          <DetailsCard
            address={address}
            phone={profile?.phone}
            website={website}
            websiteDisplay={websiteDisplay}
            category={profile?.category}
          />

          {hasHoursData(profile?.hours_json) ? (
            <BusinessHoursSummaryCard hoursJson={profile.hours_json} />
          ) : (
            <ProfileEmptyState
              title="Hours not listed"
              detail="Hours will appear here when available."
              className="px-4 py-4"
            />
          )}
        </div>
      </div>
      {supplement ? <div className="mt-5 md:mt-6">{supplement}</div> : null}
    </ProfileSection>
  );
}

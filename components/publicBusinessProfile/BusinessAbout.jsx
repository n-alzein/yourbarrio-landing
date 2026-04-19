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
      title="About"
      description="A quick overview, contact details, and practical information."
      action={headerAction}
      className={className}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.58fr)_minmax(300px,0.82fr)] lg:gap-8">
        <div className="space-y-4">
          <p className="max-w-[48rem] border-l border-[#6a3df0]/20 pl-4 text-[1.06rem] leading-[2rem] text-slate-700 sm:pl-5 sm:text-[1.1rem] sm:leading-[2.08rem]">
            {profile?.description ||
              "This business has not added a full description yet."}
          </p>

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

        <div className="space-y-3">
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
      {supplement ? <div className="mt-4">{supplement}</div> : null}
    </ProfileSection>
  );
}

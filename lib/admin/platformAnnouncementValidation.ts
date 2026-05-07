import { z } from "zod";
import {
  PLATFORM_ANNOUNCEMENT_AUDIENCES,
  PLATFORM_ANNOUNCEMENT_STATUSES,
  PLATFORM_ANNOUNCEMENT_VARIANTS,
} from "@/lib/notices/platform-announcements";

function optionalTrimmedString(max: number) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    },
    z.string().max(max).nullable()
  );
}

function optionalDateString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) return "__invalid_date__";
  return date.toISOString();
}

export function isSafeAnnouncementHref(value: string | null) {
  if (!value) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

const platformAnnouncementBaseSchema = z.object({
  title: optionalTrimmedString(120),
  message: z.string().trim().min(1).max(240),
  cta_label: optionalTrimmedString(40),
  cta_href: optionalTrimmedString(300),
  audience: z.enum(PLATFORM_ANNOUNCEMENT_AUDIENCES),
  variant: z.enum(PLATFORM_ANNOUNCEMENT_VARIANTS),
  priority: z.coerce.number().int().min(0).max(10000).default(50),
  starts_at: z.preprocess(optionalDateString, z.string().datetime().nullable()),
  ends_at: z.preprocess(optionalDateString, z.string().datetime().nullable()),
  dismissible: z.coerce.boolean().default(true),
  status: z.enum(PLATFORM_ANNOUNCEMENT_STATUSES).default("draft"),
});

export const platformAnnouncementInputSchema = platformAnnouncementBaseSchema.superRefine((value, ctx) => {
  if (value.cta_label && !value.cta_href) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cta_href"],
      message: "CTA href is required when CTA label is present.",
    });
  }
  if (!isSafeAnnouncementHref(value.cta_href)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cta_href"],
      message: "CTA href must be an internal path or https URL.",
    });
  }
  if (value.starts_at && value.ends_at && new Date(value.starts_at) >= new Date(value.ends_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ends_at"],
      message: "End time must be after start time.",
    });
  }
});

export const platformAnnouncementPatchSchema = platformAnnouncementBaseSchema.partial().superRefine(
  (value, ctx) => {
    if (value.cta_label && !value.cta_href) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cta_href"],
        message: "CTA href is required when CTA label is present.",
      });
    }
    if (value.cta_href !== undefined && !isSafeAnnouncementHref(value.cta_href)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cta_href"],
        message: "CTA href must be an internal path or https URL.",
      });
    }
    if (value.starts_at && value.ends_at && new Date(value.starts_at) >= new Date(value.ends_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message: "End time must be after start time.",
      });
    }
  }
);

"use client";

import { cx } from "@/lib/utils/cx";
import type { BusinessAvatarImage, BusinessImageInput } from "@/lib/businessImages";
import {
  getBusinessAvatarImage,
  getBusinessCategoryAccent,
  getBusinessInitials,
} from "@/lib/businessImages";

type Props = {
  business?: BusinessImageInput;
  avatar?: BusinessAvatarImage;
  className?: string;
  compact?: boolean;
  variant?: "avatar" | "cardHero" | "wordmark";
};

function getBusinessDisplayName(business?: BusinessImageInput) {
  const value =
    business?.business_name ||
    business?.name ||
    business?.full_name ||
    "Local business";
  return String(value).trim().replace(/\s+/g, " ") || "Local business";
}

const WORDMARK_FILLER_WORDS = new Set([
  "&",
  "and",
  "co",
  "company",
  "corp",
  "inc",
  "llc",
  "of",
  "shop",
  "store",
  "the",
]);

function normalizeWordmarkWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isShortWordmarkLine(word: string) {
  return word.length <= 9;
}

function getBusinessWordmarkLines(name: string, initials: string): string[] {
  const rawWords = name
    .split(/\s+/)
    .map((word) => word.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter(Boolean);

  if (!rawWords.length) return [initials];
  if (rawWords.length === 1) {
    return isShortWordmarkLine(rawWords[0]) ? [rawWords[0]] : [initials];
  }

  if (rawWords.length === 2) {
    return rawWords.every(isShortWordmarkLine) ? rawWords : [initials];
  }

  const meaningfulWords = rawWords.filter((word) => {
    const normalized = normalizeWordmarkWord(word);
    return normalized && !WORDMARK_FILLER_WORDS.has(normalized);
  });
  const firstWord = meaningfulWords[0] || rawWords[0];
  const laterWords = meaningfulWords.slice(1);
  const distinctiveLaterWord =
    laterWords
      .slice()
      .reverse()
      .find((word) => word !== firstWord) ||
    rawWords[rawWords.length - 1];
  const selectedWords = [firstWord, distinctiveLaterWord].filter(Boolean).slice(0, 2);

  if (
    selectedWords.length < 2 ||
    selectedWords.some((word) => !isShortWordmarkLine(word))
  ) {
    return [initials];
  }

  return selectedWords;
}

export default function BusinessIdentityPlaceholder({
  business,
  avatar,
  className = "",
  compact = false,
  variant = "avatar",
}: Props) {
  const resolvedAvatar = avatar || getBusinessAvatarImage(business || {});
  const initials =
    resolvedAvatar.kind === "placeholder"
      ? resolvedAvatar.initials
      : getBusinessInitials(business || {});
  const accent =
    resolvedAvatar.kind === "placeholder"
      ? resolvedAvatar.accent
      : getBusinessCategoryAccent(business?.business_type || business?.category || null);
  const isCardHero = variant === "cardHero" && !compact;
  const isWordmark = variant === "wordmark" && !compact;
  const displayName = getBusinessDisplayName(business);
  const wordmarkLines = getBusinessWordmarkLines(displayName, initials);
  const isWordmarkInitialsFallback = wordmarkLines.length === 1 && wordmarkLines[0] === initials;
  const initialsClass = compact ? "text-[1.1rem]" : "text-[2rem]";
  const useMinimalTile = !isCardHero;

  return (
    <div
      className={cx(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        className
      )}
      style={{
        background: useMinimalTile
          ? "linear-gradient(135deg, #fffaf4 0%, #fff7ef 48%, #ffffff 100%)"
          : `linear-gradient(135deg, ${accent.bgSoft} 0%, ${accent.bg} 56%, #ffffff 100%)`,
        color: useMinimalTile ? "#111827" : accent.fg,
      }}
      data-business-avatar-placeholder="true"
      data-business-avatar-placeholder-variant={variant}
    >
      {isCardHero ? (
        <div
          className="absolute inset-0 opacity-[0.36]"
          style={{
            backgroundImage: `radial-gradient(circle at 18% 24%, ${accent.pattern} 0 1.4px, transparent 2px), radial-gradient(circle at 78% 32%, ${accent.pattern} 0 1px, transparent 1.7px)`,
            backgroundSize: "36px 36px, 54px 54px",
          }}
        />
      ) : null}
      {isCardHero ? (
        <>
          <div
            className="absolute left-1/2 top-[42%] h-40 w-48 -translate-x-1/2 -translate-y-1/2 opacity-48 blur-2xl"
            style={{
              background: `radial-gradient(ellipse, ${accent.ring} 0%, rgba(255,255,255,0) 66%)`,
            }}
          />
          <div
            className="absolute -right-6 bottom-3 text-[8.5rem] font-semibold leading-none opacity-[0.038]"
            style={{ color: accent.fg }}
            aria-hidden="true"
          >
            YB
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.34),transparent_42%),linear-gradient(180deg,transparent_0%,rgba(15,23,42,0.035)_100%)]" />
        </>
      ) : null}
      {!isCardHero ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.72),transparent_62%)]" />
          <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/[0.075]" />
        </>
      ) : null}
      <div
        className={cx(
          "relative flex w-full items-center justify-center text-center",
          isCardHero ? "-translate-y-2" : "",
          isWordmark ? "px-2.5" : "px-5"
        )}
      >
        {isCardHero ? (
          <span className="line-clamp-2 max-w-[18rem] break-words text-[1.55rem] font-semibold leading-[1.12] tracking-normal text-current [text-wrap:balance] sm:text-[1.72rem]">
            {displayName}
          </span>
        ) : isWordmark ? (
          <span
            className={cx(
              "flex w-full max-w-full flex-col items-center justify-center gap-0.5 leading-[1.05] tracking-normal text-slate-950",
              isWordmarkInitialsFallback
                ? "text-[1.45rem] font-semibold sm:text-[1.6rem]"
                : "text-[0.78rem] font-semibold sm:text-[0.84rem] lg:text-[0.88rem]"
            )}
            aria-label={displayName}
          >
            {wordmarkLines.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className={cx(
                  "block max-w-full truncate",
                  index === 0 ? "font-semibold" : "font-medium text-slate-800"
                )}
              >
                {line}
              </span>
            ))}
          </span>
        ) : (
          <span
            className={cx(
              "font-semibold leading-none tracking-normal text-slate-950 drop-shadow-[0_1px_10px_rgba(255,255,255,0.45)]",
              initialsClass
            )}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

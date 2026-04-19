"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SCROLL_FLAG = "yb_purchase_history_page_scroll";

function getVisiblePages(currentPage, totalPages) {
  const visibleCount = Math.min(5, totalPages);
  let start = Math.max(1, currentPage - Math.floor(visibleCount / 2));
  const end = Math.min(totalPages, start + visibleCount - 1);
  start = Math.max(1, end - visibleCount + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function PurchaseHistoryPagination({ currentPage, totalPages }) {
  const searchParams = useSearchParams();
  const pages = getVisiblePages(currentPage, totalPages);
  const showPrevious = currentPage > 1;
  const showNext = currentPage < totalPages;

  useEffect(() => {
    if (sessionStorage.getItem(SCROLL_FLAG) !== "1") return;

    sessionStorage.removeItem(SCROLL_FLAG);
    document
      .getElementById("purchase-history-list")
      ?.scrollIntoView({ block: "start" });
  }, [searchParams]);

  if (totalPages <= 1) return null;

  const hrefForPage = (page) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `/account/purchase-history?${params.toString()}`;
  };

  const markPaginationClick = () => {
    sessionStorage.setItem(SCROLL_FLAG, "1");
  };

  return (
    <nav
      className="flex items-center justify-center gap-1.5 pt-1"
      aria-label="Purchase history pages"
    >
      {showPrevious ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          aria-label="Go to previous page"
          onClick={markPaginationClick}
          className="rounded-full border px-3 py-2 text-xs font-semibold opacity-80"
          style={{ borderColor: "var(--border)" }}
        >
          Previous
        </Link>
      ) : null}

      {pages.map((page) => {
        const isCurrent = page === currentPage;

        return (
          <Link
            key={page}
            href={hrefForPage(page)}
            aria-current={isCurrent ? "page" : undefined}
            onClick={isCurrent ? undefined : markPaginationClick}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-xs font-semibold opacity-80 aria-[current=page]:opacity-100"
            style={{
              borderColor: isCurrent ? "var(--text)" : "var(--border)",
              background: isCurrent ? "var(--surface)" : "transparent",
            }}
          >
            {page}
          </Link>
        );
      })}

      {showNext ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          aria-label="Go to next page"
          onClick={markPaginationClick}
          className="rounded-full border px-3 py-2 text-xs font-semibold opacity-80"
          style={{ borderColor: "var(--border)" }}
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}

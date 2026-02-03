"use client";

import { useEffect } from "react";

export default function CategoryPerfMark() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_NAV_PERF !== "1") return;
    try {
      performance.mark("cat_page_mount");
      performance.measure("cat_click_to_mount", "cat_nav_click", "cat_page_mount");
      const entry = performance.getEntriesByName("cat_click_to_mount").slice(-1)[0];
      // eslint-disable-next-line no-console
      console.log("[perf] cat_click_to_mount(ms)", entry?.duration);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

export function useGridVirtualRows({
  rowCount,
  rowHeight,
  rowGap = 0,
  overscan = 4,
  containerRef,
}) {
  const safeOverscan = Math.max(2, Number(overscan) || 0);
  const safeRowHeight = Math.max(1, Number(rowHeight) || 360);
  const safeRowGap = Math.max(0, Number(rowGap) || 0);
  const [viewport, setViewport] = useState(() => ({
    scrollTop: 0,
    height: 0,
    containerHeight: 0,
  }));
  const containerTopRef = useRef(0);
  const rafRef = useRef(0);

  const updateMetrics = useCallback(() => {
    if (typeof window === "undefined") return;
    const container = containerRef?.current;
    const rect = container?.getBoundingClientRect?.();
    const scrollTop =
      window.scrollY || document.documentElement?.scrollTop || 0;
    const height =
      window.innerHeight || document.documentElement?.clientHeight || 800;
    const containerTop = rect ? rect.top + scrollTop : 0;
    const containerHeight = rect?.height ?? 0;
    containerTopRef.current = containerTop;
    setViewport((prev) => {
      const next = { scrollTop, height, containerHeight };
      if (prev.scrollTop === next.scrollTop && prev.height === next.height) {
        return prev;
      }
      return next;
    });
  }, [containerRef]);

  useLayoutEffect(() => {
    updateMetrics();
  }, [updateMetrics, rowCount, rowHeight, rowGap]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        updateMetrics();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    let observer;
    if (typeof ResizeObserver !== "undefined" && containerRef?.current) {
      observer = new ResizeObserver(onScroll);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (observer) observer.disconnect();
    };
  }, [containerRef, updateMetrics]);

  const rowStride = safeRowHeight + safeRowGap;
  const totalHeight = rowCount > 0 ? rowCount * rowStride - safeRowGap : 0;

  const { scrollTop, height, containerHeight } = viewport;
  const relativeTop = scrollTop - containerTopRef.current;
  const startIndex =
    rowCount > 0
      ? Math.max(0, Math.floor(relativeTop / rowStride) - safeOverscan)
      : 0;
  const endIndex =
    rowCount > 0
      ? Math.min(
          rowCount - 1,
          Math.ceil((relativeTop + height) / rowStride) + safeOverscan
        )
      : -1;

  const virtualRows = useMemo(() => {
    if (!rowCount || !rowStride) return [];
    const items = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      if (index < 0 || index >= rowCount) continue;
      items.push({ index, start: index * rowStride, size: rowStride });
    }
    return items;
  }, [rowCount, rowStride, startIndex, endIndex]);

  return {
    virtualRows,
    totalHeight,
    startIndex,
    endIndex,
    rowStride,
    scrollTop,
    viewportHeight: height,
    containerHeight,
  };
}

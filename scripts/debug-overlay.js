(() => {
  const center = { x: window.innerWidth / 2, y: 120 };
  const el = document.elementFromPoint(center.x, center.y);
  if (!el) {
    console.log("[overlay-debug] no element at point", center);
    return;
  }
  const chain = [];
  let cur = el;
  while (cur && chain.length < 10) {
    const cs = getComputedStyle(cur);
    const rect = cur.getBoundingClientRect();
    chain.push({
      tag: cur.tagName.toLowerCase(),
      id: cur.id,
      class: cur.className,
      z: cs.zIndex,
      pos: cs.position,
      pe: cs.pointerEvents,
      opacity: cs.opacity,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
    });
    cur = cur.parentElement;
  }
  console.log("[overlay-debug] chain:", chain);
})();

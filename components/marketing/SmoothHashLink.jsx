"use client";

export default function SmoothHashLink({ href, className = "", children }) {
  const handleClick = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      typeof window === "undefined" ||
      !href?.startsWith("#")
    ) {
      return;
    }

    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!target) return;

    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    window.history.pushState(null, "", href);
  };

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}

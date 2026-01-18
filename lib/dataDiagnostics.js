export const isDataDiagEnabled = () =>
  process.env.NEXT_PUBLIC_DATA_DIAG === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

export const logDataDiag = (event, payload = {}) => {
  if (!isDataDiagEnabled() || typeof window === "undefined") return;
  const timestamp = new Date().toISOString();
  const pathname = window.location.pathname;
  console.log("[DATA_DIAG]", { timestamp, pathname, event, ...payload });
};

const authDiagEnabled = () =>
  process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
  process.env.NODE_ENV !== "production";

export function authDiagLog(event, payload = {}) {
  if (!authDiagEnabled()) return;
  console.warn("[AUTH_DIAG]", {
    event,
    ...payload,
  });
}

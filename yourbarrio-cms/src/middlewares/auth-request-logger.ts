export default (_config, { strapi }) => {
  return async (ctx, next) => {
    const startedAt = Date.now();
    try {
      await next();
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const path = ctx?.request?.path || ctx?.path || ctx?.url || "";
      if (path) {
        const method = ctx?.request?.method || ctx?.method || "UNKNOWN";
        strapi.log.info(
          `[AUTH_DEBUG] ${method} ${path} status=${ctx.status ?? 500} durationMs=${durationMs} timeoutMs=none error=${err?.message ?? "unknown"}`
        );
      }
      throw err;
    }

    const durationMs = Date.now() - startedAt;
    const path = ctx?.request?.path || ctx?.path || ctx?.url || "";
    if (!path) return;

    const isAuthPath =
      path.startsWith("/admin/login") ||
      path.startsWith("/admin/init") ||
      path.startsWith("/api/auth/local") ||
      path.startsWith("/auth/local");
    if (!isAuthPath) return;

    const method = ctx?.request?.method || ctx?.method || "UNKNOWN";
    strapi.log.info(
      `[AUTH_DEBUG] ${method} ${path} status=${ctx.status ?? 200} durationMs=${durationMs} timeoutMs=none`
    );
  };
};

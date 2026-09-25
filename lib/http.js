export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "method_not_allowed" });
}

export function parseCookies(req) {
  const header = req.headers?.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index === -1 ? part : part.slice(0, index);
        const value = index === -1 ? "" : part.slice(index + 1);
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  );
}

export function secureCookie(name, value, options = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  return parts.join("; ");
}

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

export function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message.startsWith("MISSING_ENV:")) return "server_not_configured";
  if (message === "INVALID_OAUTH_STATE") return "invalid_state";
  if (message === "OAUTH_STATE_EXPIRED") return "state_expired";
  if (message === "TOKEN_EXCHANGE_FAILED") return "token_exchange_failed";
  return "server_error";
}

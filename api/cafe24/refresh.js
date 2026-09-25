import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies, secureCookie } from "../../lib/http.js";
import { openTokens, refreshTokens, sealTokens } from "../../lib/oauth.js";
import { persistentTokenStoreConfigured, savePersistentTokens } from "../../lib/token-store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const config = getConfig(req);
    const sealed = parseCookies(req).sanji_cafe24_tokens;
    if (!sealed) return res.status(401).json({ error: "not_connected" });
    const current = openTokens(sealed, config.encryptionKey);
    if (!current.refresh_token) return res.status(401).json({ error: "refresh_token_missing" });
    const refreshed = { ...current, ...(await refreshTokens(config, current.refresh_token)) };
    if (persistentTokenStoreConfigured()) await savePersistentTokens(config, refreshed);
    res.setHeader(
      "Set-Cookie",
      secureCookie("sanji_cafe24_tokens", sealTokens(refreshed, config.encryptionKey), {
        maxAge: 14 * 24 * 60 * 60,
      }),
    );
    return res.status(200).json({
      refreshed: true,
      expires_at: refreshed.expires_at || null,
      refresh_token_expires_at: refreshed.refresh_token_expires_at || null,
    });
  } catch {
    return res.status(502).json({ error: "token_refresh_failed" });
  }
}

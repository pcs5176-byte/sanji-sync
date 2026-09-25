import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies } from "../../lib/http.js";
import { openTokens } from "../../lib/oauth.js";
import { loadPersistentTokens, persistentTokenStoreConfigured } from "../../lib/token-store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const config = getConfig(req);
    const sealed = parseCookies(req).sanji_cafe24_tokens;
    if (!sealed) {
      return res.status(200).json({
        connected: false,
        persistent_store_configured: persistentTokenStoreConfigured(),
      });
    }
    const tokens = openTokens(sealed, config.encryptionKey);
    let persistentConnected = false;
    if (persistentTokenStoreConfigured()) {
      try {
        persistentConnected = Boolean(await loadPersistentTokens(config));
      } catch {
        persistentConnected = false;
      }
    }
    return res.status(200).json({
      connected: true,
      mall_id: tokens.mall_id || config.mallId,
      shop_no: config.shopNo,
      scopes: Array.isArray(tokens.scopes) ? tokens.scopes : config.scopes,
      expires_at: tokens.expires_at || null,
      refresh_token_expires_at: tokens.refresh_token_expires_at || null,
      persistent_store_configured: persistentTokenStoreConfigured(),
      persistent_connected: persistentConnected,
    });
  } catch {
    return res.status(200).json({ connected: false, reason: "invalid_or_missing_session" });
  }
}

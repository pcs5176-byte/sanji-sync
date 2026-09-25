import { cafe24AdminRequest } from "../../lib/cafe24.js";
import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies } from "../../lib/http.js";
import { openTokens, refreshTokens } from "../../lib/oauth.js";
import {
  loadPersistentTokens,
  persistentTokenStoreConfigured,
  savePersistentTokens,
} from "../../lib/token-store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const config = getConfig(req);
    const browserSession = parseCookies(req).sanji_cafe24_tokens;
    if (!browserSession) return res.status(401).json({ error: "not_connected" });
    openTokens(browserSession, config.encryptionKey);

    if (!persistentTokenStoreConfigured()) {
      return res.status(503).json({ error: "persistent_token_store_not_configured" });
    }
    let tokens = await loadPersistentTokens(config);
    if (!tokens?.access_token || !tokens?.refresh_token) {
      return res.status(409).json({ error: "persistent_connection_missing" });
    }

    let result;
    try {
      result = await cafe24AdminRequest(config, tokens.access_token, "products/count", {
        shop_no: config.shopNo,
      });
    } catch (error) {
      if (error?.status !== 401) throw error;
      tokens = { ...tokens, ...(await refreshTokens(config, tokens.refresh_token)) };
      await savePersistentTokens(config, tokens);
      result = await cafe24AdminRequest(config, tokens.access_token, "products/count", {
        shop_no: config.shopNo,
      });
    }

    return res.status(200).json({
      ok: true,
      mall_id: config.mallId,
      shop_no: config.shopNo,
      persistent_connection: true,
      product_read_access: true,
      product_count: Number.isFinite(Number(result?.count)) ? Number(result.count) : null,
    });
  } catch {
    return res.status(502).json({ error: "cafe24_connection_verification_failed" });
  }
}

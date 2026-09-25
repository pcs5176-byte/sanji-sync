import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies } from "../../lib/http.js";
import { openTokens, refreshTokens } from "../../lib/oauth.js";
import { buildSyncPreview, currentSourceCatalog, fetchMappedCafe24Products } from "../../lib/sync.js";
import { adminPlusConfigured } from "../../lib/adminplus.js";
import { executeProductSync } from "../../lib/sync-runner.js";
import { loadPersistentTokens, savePersistentTokens } from "../../lib/token-store.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const config = getConfig(req);
    const browserSession = parseCookies(req).sanji_cafe24_tokens;
    if (!browserSession) return res.status(401).json({ error: "not_connected" });
    openTokens(browserSession, config.encryptionKey);

    let tokens = await loadPersistentTokens(config);
    if (!tokens?.access_token || !tokens?.refresh_token) {
      return res.status(409).json({ error: "persistent_connection_missing" });
    }

    if (adminPlusConfigured()) {
      const result = await executeProductSync(config, { writeEnabled: false });
      return res.status(200).json(result);
    }

    const catalog = currentSourceCatalog();
    let products;
    try {
      products = await fetchMappedCafe24Products(config, tokens.access_token, catalog);
    } catch (error) {
      if (error?.status !== 401) throw error;
      tokens = { ...tokens, ...(await refreshTokens(config, tokens.refresh_token)) };
      await savePersistentTokens(config, tokens);
      products = await fetchMappedCafe24Products(config, tokens.access_token, catalog);
    }

    return res.status(200).json(buildSyncPreview(catalog, products));
  } catch {
    return res.status(502).json({ error: "sync_preview_failed" });
  }
}

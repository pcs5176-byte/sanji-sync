import crypto from "node:crypto";
import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore } from "../../lib/http.js";
import { refreshTokens } from "../../lib/oauth.js";
import {
  loadPersistentTokens,
  persistentTokenStoreConfigured,
  savePersistentTokens,
} from "../../lib/token-store.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers?.authorization;
  if (!secret || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  if (!persistentTokenStoreConfigured()) {
    return res.status(503).json({ error: "persistent_token_store_not_configured" });
  }

  try {
    const config = getConfig(req);
    const current = await loadPersistentTokens(config);
    if (!current?.refresh_token) return res.status(409).json({ error: "persistent_connection_missing" });
    const refreshed = { ...current, ...(await refreshTokens(config, current.refresh_token)) };
    await savePersistentTokens(config, refreshed);
    return res.status(200).json({
      refreshed: true,
      mall_id: refreshed.mall_id || config.mallId,
      shop_no: config.shopNo,
      expires_at: refreshed.expires_at || null,
      refresh_token_expires_at: refreshed.refresh_token_expires_at || null,
    });
  } catch {
    return res.status(502).json({ error: "scheduled_token_refresh_failed" });
  }
}

import { getConfig } from "../lib/config.js";
import { noStore } from "../lib/http.js";
import { persistentTokenStoreConfigured } from "../lib/token-store.js";
import { adminPlusConfigured } from "../lib/adminplus.js";

export default function handler(req, res) {
  noStore(res);
  try {
    const config = getConfig(req, { requireCredentials: false });
    return res.status(200).json({
      ok: true,
      service: "sanji-sync",
      cafe24: {
        mall_id: config.mallId,
        shop_no: config.shopNo,
        redirect_uri: config.redirectUri,
        credentials_configured: Boolean(
          config.clientId && config.clientSecret && config.stateSecret && config.encryptionKey,
        ),
        persistent_token_store_configured: persistentTokenStoreConfigured(),
        scheduled_refresh_configured: Boolean(process.env.CRON_SECRET),
        adminplus_configured: adminPlusConfigured(),
        product_sync_write_enabled: process.env.SYNC_WRITE_ENABLED === "true",
      },
    });
  } catch {
    return res.status(500).json({ ok: false, error: "invalid_server_configuration" });
  }
}

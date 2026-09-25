import crypto from "node:crypto";
import { adminPlusConfigured } from "./adminplus.js";
import { getConfig } from "./config.js";
import { methodNotAllowed, noStore } from "./http.js";
import { executeProductSync } from "./sync-runner.js";
import { persistentTokenStoreConfigured } from "./token-store.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers?.authorization;
  if (!secret || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  if (!persistentTokenStoreConfigured()) {
    return res.status(503).json({ error: "persistent_token_store_not_configured" });
  }
  if (!adminPlusConfigured()) {
    return res.status(503).json({ error: "adminplus_credentials_not_configured" });
  }
  try {
    const config = getConfig(req);
    const writeEnabled = process.env.SYNC_WRITE_ENABLED === "true";
    const result = await executeProductSync(config, { writeEnabled });
    return res.status(200).json(result);
  } catch {
    return res.status(502).json({ error: "scheduled_product_sync_failed" });
  }
}

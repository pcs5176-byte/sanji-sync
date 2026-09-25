import { getAppUrl, getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies, safeErrorCode, secureCookie } from "../../lib/http.js";
import { exchangeCode, sealTokens, verifyState } from "../../lib/oauth.js";
import { persistentTokenStoreConfigured, savePersistentTokens } from "../../lib/token-store.js";

function redirectResult(res, appUrl, params) {
  const url = new URL("/connected.html", appUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return res.redirect(302, url.toString());
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  let appUrl;
  try {
    appUrl = getAppUrl(req);
    const config = getConfig(req);
    const error = typeof req.query?.error === "string" ? req.query.error : null;
    if (error) return redirectResult(res, appUrl, { error: "authorization_denied" });

    const code = typeof req.query?.code === "string" ? req.query.code : null;
    const state = typeof req.query?.state === "string" ? req.query.state : null;
    if (!code || !state) return redirectResult(res, appUrl, { error: "missing_code_or_state" });

    const cookies = parseCookies(req);
    verifyState(state, cookies.sanji_oauth_state, config.stateSecret);
    const tokens = await exchangeCode(config, code);
    const sealed = sealTokens(tokens, config.encryptionKey);
    if (persistentTokenStoreConfigured()) await savePersistentTokens(config, tokens);

    res.setHeader("Set-Cookie", [
      secureCookie("sanji_oauth_state", "", { maxAge: 0 }),
      secureCookie("sanji_cafe24_tokens", sealed, { maxAge: 14 * 24 * 60 * 60 }),
    ]);
    return redirectResult(res, appUrl, {
      connected: 1,
      mall_id: tokens.mall_id || config.mallId,
      shop_no: config.shopNo,
      durable: persistentTokenStoreConfigured() ? 1 : 0,
    });
  } catch (error) {
    if (!appUrl) return res.status(500).json({ error: safeErrorCode(error) });
    return redirectResult(res, appUrl, { error: safeErrorCode(error) });
  }
}

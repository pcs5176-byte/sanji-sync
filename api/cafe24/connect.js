import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, secureCookie, safeErrorCode } from "../../lib/http.js";
import { buildAuthorizeUrl, createState } from "../../lib/oauth.js";

export default function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const config = getConfig(req);
    const state = createState(config.stateSecret);
    res.setHeader("Set-Cookie", secureCookie("sanji_oauth_state", state, { maxAge: 600 }));
    return res.redirect(302, buildAuthorizeUrl(config, state));
  } catch (error) {
    return res.status(503).json({
      error: safeErrorCode(error),
      message: "Cafe24 OAuth 환경변수를 먼저 설정해 주세요.",
    });
  }
}

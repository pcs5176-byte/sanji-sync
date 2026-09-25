import { methodNotAllowed, noStore, secureCookie } from "../../lib/http.js";

export default function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  res.setHeader("Set-Cookie", secureCookie("sanji_cafe24_tokens", "", { maxAge: 0 }));
  return res.status(200).json({ disconnected: true });
}

import crypto from "node:crypto";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function createState(secret, now = Date.now()) {
  const payload = b64url(
    JSON.stringify({ nonce: crypto.randomBytes(24).toString("base64url"), exp: now + 10 * 60_000 }),
  );
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state, cookieState, secret, now = Date.now()) {
  if (!state || !cookieState || state !== cookieState) throw new Error("INVALID_OAUTH_STATE");
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("INVALID_OAUTH_STATE");

  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("INVALID_OAUTH_STATE");
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("INVALID_OAUTH_STATE");
  }
  if (!Number.isFinite(parsed.exp) || parsed.exp < now) throw new Error("OAUTH_STATE_EXPIRED");
  return true;
}

function deriveKey(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function sealTokens(tokens, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function openTokens(value, secret) {
  try {
    const [ivText, tagText, ciphertextText] = value.split(".");
    if (!ivText || !tagText || !ciphertextText) throw new Error("bad token");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch {
    throw new Error("INVALID_TOKEN_COOKIE");
  }
}

export function buildAuthorizeUrl(config, state) {
  const url = new URL(`https://${config.mallId}.cafe24api.com/api/v2/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  return url.toString();
}

async function tokenRequest(config, params) {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64");
  const response = await fetch(`https://${config.mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    console.error("Cafe24 token request failed with HTTP status", response.status);
    throw new Error("TOKEN_EXCHANGE_FAILED");
  }
  return response.json();
}

export function exchangeCode(config, code) {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
}

export function refreshTokens(config, refreshToken) {
  return tokenRequest(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

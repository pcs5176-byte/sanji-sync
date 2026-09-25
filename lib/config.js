const DEFAULT_SCOPES = [
  "mall.read_product",
  "mall.write_product",
  "mall.read_store",
  "mall.read_category",
];

function readHeader(req, name) {
  const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getAppUrl(req) {
  if (process.env.CAFE24_REDIRECT_URI) {
    return new URL(process.env.CAFE24_REDIRECT_URI).origin;
  }
  if (process.env.APP_URL) return new URL(process.env.APP_URL).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  const host = readHeader(req, "host");
  if (!host) throw new Error("APP_URL_OR_REDIRECT_URI_REQUIRED");
  const protocol = readHeader(req, "x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

export function getConfig(req, { requireCredentials = true } = {}) {
  const mallId = process.env.CAFE24_MALL_ID || "cokorzone001";
  if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(mallId)) {
    throw new Error("INVALID_CAFE24_MALL_ID");
  }

  const shopNo = Number.parseInt(process.env.CAFE24_SHOP_NO || "3", 10);
  if (!Number.isInteger(shopNo) || shopNo < 1) {
    throw new Error("INVALID_CAFE24_SHOP_NO");
  }

  const appUrl = getAppUrl(req);
  const redirectUri = process.env.CAFE24_REDIRECT_URI || `${appUrl}/api/cafe24/callback`;
  const scopes = (process.env.CAFE24_SCOPES || DEFAULT_SCOPES.join(" "))
    .split(/\s+/)
    .filter(Boolean);
  const clientId = process.env.CAFE24_CLIENT_ID;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET;
  const stateSecret = process.env.OAUTH_STATE_SECRET;
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (requireCredentials) {
    const missing = [
      ["CAFE24_CLIENT_ID", clientId],
      ["CAFE24_CLIENT_SECRET", clientSecret],
      ["OAUTH_STATE_SECRET", stateSecret],
      ["TOKEN_ENCRYPTION_KEY", encryptionKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) throw new Error(`MISSING_ENV:${missing.join(",")}`);
  }

  return {
    appUrl,
    redirectUri,
    mallId,
    shopNo,
    scopes,
    clientId,
    clientSecret,
    stateSecret,
    encryptionKey,
  };
}

export { DEFAULT_SCOPES };

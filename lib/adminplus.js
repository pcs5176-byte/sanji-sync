const BASE_URL = "https://api.adminplus.co.kr";

function credentials() {
  const clientId = process.env.ADMINPLUS_CLIENT_ID;
  const clientSecret = process.env.ADMINPLUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("ADMINPLUS_CREDENTIALS_REQUIRED");
  return { clientId, clientSecret };
}

export function adminPlusConfigured() {
  return Boolean(process.env.ADMINPLUS_CLIENT_ID && process.env.ADMINPLUS_CLIENT_SECRET);
}

export async function fetchAdminPlusToken() {
  const { clientId, clientSecret } = credentials();
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const error = new Error("ADMINPLUS_TOKEN_FAILED");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  if (!payload?.success || !payload?.data?.access_token) {
    throw new Error("ADMINPLUS_TOKEN_INVALID_RESPONSE");
  }
  return payload.data.access_token;
}

export async function fetchAdminPlusProducts(accessToken) {
  const products = [];
  let cursor = null;
  do {
    const url = new URL(`${BASE_URL}/v1/seller/products`);
    url.searchParams.set("limit", "500");
    url.searchParams.set("status", "active");
    if (cursor !== null && cursor !== undefined && cursor !== "") {
      url.searchParams.set("cursor", String(cursor));
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!response.ok) {
      const error = new Error("ADMINPLUS_PRODUCTS_FAILED");
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    if (!payload?.success || !Array.isArray(payload?.data?.items)) {
      throw new Error("ADMINPLUS_PRODUCTS_INVALID_RESPONSE");
    }
    products.push(...payload.data.items);
    cursor = payload.data.has_more ? payload.data.next_cursor : null;
  } while (cursor !== null && cursor !== undefined && cursor !== "");
  return products;
}

import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthorizeUrl, createState, openTokens, sealTokens, verifyState } from "../lib/oauth.js";
import {
  loadPersistentTokens,
  persistentTokenStoreConfigured,
  savePersistentTokens,
} from "../lib/token-store.js";
import { buildAdminApiUrl } from "../lib/cafe24.js";
import { buildSyncPreview } from "../lib/sync.js";

test("OAuth authorize URL contains the required Cafe24 parameters", () => {
  const url = new URL(buildAuthorizeUrl({
    mallId: "cokorzone001",
    clientId: "client-id",
    redirectUri: "https://sanji-sync.vercel.app/api/cafe24/callback",
    scopes: ["mall.read_product", "mall.write_product", "mall.read_store", "mall.read_category"],
  }, "signed-state"));
  assert.equal(url.origin, "https://cokorzone001.cafe24api.com");
  assert.equal(url.pathname, "/api/v2/oauth/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "signed-state");
  assert.equal(url.searchParams.get("scope"), "mall.read_product mall.write_product mall.read_store mall.read_category");
});

test("state is signed, expires, and rejects tampering", () => {
  const state = createState("state-secret", 1_000);
  assert.equal(verifyState(state, state, "state-secret", 2_000), true);
  assert.throws(() => verifyState(`${state}x`, `${state}x`, "state-secret", 2_000), /INVALID_OAUTH_STATE/);
  assert.throws(() => verifyState(state, state, "state-secret", 700_000), /OAUTH_STATE_EXPIRED/);
});

test("token payload is encrypted and authenticated", () => {
  const input = { access_token: "access-secret", refresh_token: "refresh-secret", mall_id: "cokorzone001" };
  const sealed = sealTokens(input, "encryption-secret");
  assert.equal(sealed.includes("access-secret"), false);
  assert.deepEqual(openTokens(sealed, "encryption-secret"), input);
  const parts = sealed.split(".");
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  assert.throws(() => openTokens(parts.join("."), "encryption-secret"), /INVALID_TOKEN_COOKIE/);
});

test("persistent store saves only ciphertext and restores tokens", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousFetch = global.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-secret";
  const values = new Map();
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(options);
    const [command, key, value] = JSON.parse(options.body);
    if (command === "SET") {
      values.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    return { ok: true, json: async () => ({ result: values.get(key) ?? null }) };
  };

  try {
    const config = { mallId: "cokorzone001", encryptionKey: "encryption-secret" };
    const tokens = { access_token: "access-secret", refresh_token: "refresh-secret" };
    assert.equal(persistentTokenStoreConfigured(), true);
    await savePersistentTokens(config, tokens);
    assert.equal(requests[0].body.includes("access-secret"), false);
    assert.equal(requests[0].headers.Authorization, "Bearer redis-secret");
    assert.deepEqual(await loadPersistentTokens(config), tokens);
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test("Cafe24 admin API URL always targets the configured multi-shop", () => {
  const url = buildAdminApiUrl(
    { mallId: "cokorzone001" },
    "products/count",
    { shop_no: 3 },
  );
  assert.equal(url.origin, "https://cokorzone001.cafe24api.com");
  assert.equal(url.pathname, "/api/v2/admin/products/count");
  assert.equal(url.searchParams.get("shop_no"), "3");
});

test("sync preview reports changes without enabling writes", () => {
  const catalog = {
    live_source_connected: false,
    write_enabled: false,
    source_file_modified_at: "2026-09-10T00:00:00.000Z",
    product_count: 1,
    option_count: 1,
    products: [{
      group_id: "G0001",
      custom_product_code: "HARU-G0001",
      cafe24_product_name: "테스트 상품",
      expected_sale_price: 16900,
      expected_retail_price: 22900,
      options: [{ option_label: "5kg", expected_sale_price: 16900 }],
    }],
  };
  const preview = buildSyncPreview(catalog, [{
    product_no: 1,
    product_code: "P0000001",
    custom_product_code: "HARU-G0001",
    product_name: "테스트 상품",
    price: "15900.00",
    retail_price: "21900.00",
    variants: [{ options: [{ value: "5kg" }], additional_amount: "0.00" }],
  }]);
  assert.equal(preview.mode, "dry_run");
  assert.equal(preview.write_enabled, false);
  assert.equal(preview.matched_products, 1);
  assert.equal(preview.sale_price_changes, 1);
  assert.equal(preview.retail_price_changes, 1);
});

test("sync preview counts a plain Cafe24 product as its single source option", () => {
  const catalog = {
    live_source_connected: false,
    write_enabled: false,
    source_file_modified_at: "2026-09-10T00:00:00.000Z",
    product_count: 1,
    option_count: 1,
    products: [{
      group_id: "G0001",
      custom_product_code: "HARU-G0001",
      cafe24_product_name: "단일 상품",
      expected_sale_price: 16900,
      expected_retail_price: 22900,
      options: [{ option_label: "1kg", expected_sale_price: 16900 }],
    }],
  };
  const preview = buildSyncPreview(catalog, [{
    product_no: 1,
    custom_product_code: "HARU-G0001",
    product_name: "단일 상품",
    price: "16900.00",
    retail_price: "22900.00",
    variants: [],
  }]);
  assert.equal(preview.matched_options, 1);
  assert.equal(preview.unmatched_options, 0);
});

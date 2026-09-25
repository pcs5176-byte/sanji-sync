import { openTokens, sealTokens } from "./oauth.js";

function redisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

export function persistentTokenStoreConfigured() {
  const { url, token } = redisCredentials();
  return Boolean(url && token);
}

function tokenKey(config) {
  return `sanji-sync:cafe24:${config.mallId}:tokens`;
}

async function redisCommand(command) {
  const { url, token } = redisCredentials();
  if (!url || !token) throw new Error("TOKEN_STORE_NOT_CONFIGURED");

  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) throw new Error("TOKEN_STORE_REQUEST_FAILED");
  const payload = await response.json();
  if (payload?.error) throw new Error("TOKEN_STORE_COMMAND_FAILED");
  return payload?.result;
}

export async function savePersistentTokens(config, tokens) {
  const sealed = sealTokens(tokens, config.encryptionKey);
  await redisCommand(["SET", tokenKey(config), sealed]);
}

export async function loadPersistentTokens(config) {
  const sealed = await redisCommand(["GET", tokenKey(config)]);
  if (!sealed) return null;
  return openTokens(sealed, config.encryptionKey);
}

export async function deletePersistentTokens(config) {
  return redisCommand(["DEL", tokenKey(config)]);
}
